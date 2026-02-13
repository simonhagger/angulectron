import { spawn, type ChildProcess } from 'node:child_process';
import { access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';

type PythonHealth = {
  status: string;
  service: string;
  pythonVersion: string;
  pymupdfAvailable: boolean;
  pymupdfVersion?: string;
  pymupdfError?: string;
};

type PythonProbeResult = {
  available: boolean;
  started: boolean;
  running: boolean;
  endpoint: string;
  pid?: number;
  pythonCommand?: string;
  message?: string;
  health?: PythonHealth;
};

type PythonStopResult = {
  stopped: boolean;
  running: boolean;
  message?: string;
};

type PythonInspectPdfResult = {
  accepted: boolean;
  fileName: string;
  fileSizeBytes: number;
  headerHex: string;
  pythonVersion: string;
  pymupdfAvailable: boolean;
  pymupdfVersion?: string;
  message?: string;
};

type CommandCandidate = {
  command: string;
  args: string[];
};

type PythonSidecarOptions = {
  scriptPath: string;
  host: string;
  port: number;
  startupTimeoutMs?: number;
  logger?: (
    level: 'debug' | 'info' | 'warn' | 'error',
    event: string,
    details?: Record<string, unknown>,
  ) => void;
};

type StartWithCandidateResult =
  | { kind: 'success'; health: PythonHealth }
  | { kind: 'failure'; message: string };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class PythonSidecar {
  private readonly scriptPath: string;
  private readonly host: string;
  private readonly port: number;
  private readonly startupTimeoutMs: number;
  private readonly logger?: PythonSidecarOptions['logger'];

  private process: ChildProcess | null = null;
  private command: string | null = null;

  constructor(options: PythonSidecarOptions) {
    this.scriptPath = options.scriptPath;
    this.host = options.host;
    this.port = options.port;
    this.startupTimeoutMs = options.startupTimeoutMs ?? 8_000;
    this.logger = options.logger;
  }

  private get endpoint(): string {
    return `http://${this.host}:${this.port}/health`;
  }

  async probe(): Promise<PythonProbeResult> {
    const scriptExists = await this.scriptIsReadable();
    if (!scriptExists) {
      return {
        available: false,
        started: false,
        running: false,
        endpoint: this.endpoint,
        message: `Python sidecar script not found: ${this.scriptPath}`,
      };
    }

    const runningHealth = await this.fetchHealth();
    if (runningHealth) {
      return {
        available: true,
        started: false,
        running: true,
        endpoint: this.endpoint,
        pid: this.process?.pid,
        pythonCommand: this.command ?? undefined,
        health: runningHealth,
      };
    }

    await this.stop();

    let lastMessage = 'No Python interpreter command was successful.';
    for (const candidate of this.commandCandidates()) {
      const result = await this.startWithCandidate(candidate);
      if (result.kind === 'success') {
        return {
          available: true,
          started: true,
          running: true,
          endpoint: this.endpoint,
          pid: this.process?.pid,
          pythonCommand: this.command ?? undefined,
          health: result.health,
        };
      } else {
        lastMessage = result.message;
      }
    }

    return {
      available: false,
      started: false,
      running: false,
      endpoint: this.endpoint,
      message: lastMessage,
    };
  }

  async stop(): Promise<PythonStopResult> {
    const process = this.process;
    if (!process || process.killed || process.exitCode !== null) {
      this.process = null;
      this.command = null;
      return {
        stopped: false,
        running: false,
        message: 'Python sidecar is not running.',
      };
    }

    this.log('info', 'python.sidecar.stop.requested', { pid: process.pid });
    process.kill();
    await wait(250);

    if (process.exitCode === null && !process.killed) {
      process.kill('SIGKILL');
    }

    this.process = null;
    this.command = null;

    return { stopped: true, running: false };
  }

  async inspectPdf(filePath: string): Promise<PythonInspectPdfResult> {
    const response = await fetch(
      this.endpoint.replace('/health', '/inspect-pdf'),
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ filePath }),
        signal: AbortSignal.timeout(15_000),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Python inspect endpoint returned ${response.status} ${response.statusText}`,
      );
    }

    return (await response.json()) as PythonInspectPdfResult;
  }

  dispose() {
    void this.stop();
  }

  private async scriptIsReadable(): Promise<boolean> {
    try {
      await access(this.scriptPath, fsConstants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  private commandCandidates(): CommandCandidate[] {
    const explicit = process.env.PYTHON_SIDECAR_COMMAND;
    if (explicit && explicit.trim().length > 0) {
      const [command, ...args] = explicit.trim().split(/\s+/);
      return [{ command, args }];
    }

    if (process.platform === 'win32') {
      return [
        { command: 'python', args: [] },
        { command: 'py', args: ['-3'] },
      ];
    }

    return [
      { command: 'python3', args: [] },
      { command: 'python', args: [] },
    ];
  }

  private async startWithCandidate(
    candidate: CommandCandidate,
  ): Promise<StartWithCandidateResult> {
    const args = [
      ...candidate.args,
      this.scriptPath,
      '--host',
      this.host,
      '--port',
      String(this.port),
    ];

    this.log('info', 'python.sidecar.start.attempt', {
      command: candidate.command,
      args,
    });

    const child = spawn(candidate.command, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stderr?.once('data', (chunk: Buffer) => {
      this.log('warn', 'python.sidecar.stderr', {
        command: candidate.command,
        message: chunk.toString().slice(0, 500),
      });
    });

    const startDeadline = Date.now() + this.startupTimeoutMs;
    while (Date.now() < startDeadline) {
      if (child.exitCode !== null) {
        return {
          kind: 'failure',
          message: `Python command exited early: ${candidate.command}`,
        };
      }

      const health = await this.fetchHealth();
      if (health) {
        this.process = child;
        this.command = candidate.command;
        this.log('info', 'python.sidecar.start.success', {
          command: candidate.command,
          pid: child.pid,
        });
        return { kind: 'success', health };
      }

      await wait(250);
    }

    child.kill();
    return {
      kind: 'failure',
      message: `Python sidecar startup timed out using command: ${candidate.command}`,
    };
  }

  private async fetchHealth(): Promise<PythonHealth | null> {
    try {
      const response = await fetch(this.endpoint, {
        signal: AbortSignal.timeout(800),
      });
      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as PythonHealth;
      if (!payload || typeof payload !== 'object') {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }

  private log(
    level: 'debug' | 'info' | 'warn' | 'error',
    event: string,
    details?: Record<string, unknown>,
  ) {
    this.logger?.(level, event, details);
  }
}

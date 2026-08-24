import { spawn } from 'node:child_process';

export type ProviderConfig = {
  baseUrl: string;
  model: string;
  apiKey?: string;
};

export type OpenAiCompatibleResult = {
  text: string;
  modelUsed: string;
};

export type CliAgentId = 'claude' | 'codex' | 'opencode';

export type CliAgentStatus = {
  id: CliAgentId;
  available: boolean;
  detail?: string;
};

export type CommandRunResult = {
  code: number | null;
  stdout: string;
  stderr: string;
};

export type CommandRunner = (
  command: string,
  args: string[],
  timeoutMs: number,
) => Promise<CommandRunResult>;

const CLI_AGENT_DEFS: Array<{
  id: CliAgentId;
  command: string;
  runArgs: (prompt: string) => string[];
}> = [
  {
    id: 'claude',
    command: 'claude',
    runArgs: (prompt) => ['-p', prompt, '--output-format', 'text'],
  },
  {
    id: 'codex',
    command: 'codex',
    runArgs: (prompt) => ['exec', prompt],
  },
  {
    id: 'opencode',
    command: 'opencode',
    runArgs: (prompt) => ['run', prompt],
  },
];

export const defaultCommandRunner: CommandRunner = (command, args, timeoutMs) =>
  new Promise((resolve) => {
    const child = spawn(command, args, {
      windowsHide: true,
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill();
        resolve({ code: null, stdout, stderr: stderr || 'timed out' });
      }
    }, timeoutMs);

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve({ code: -1, stdout, stderr: stderr || 'spawn failed' });
      }
    });
    child.on('exit', (code) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve({ code, stdout, stderr });
      }
    });
  });

export async function detectCliAgents(
  runner: CommandRunner = defaultCommandRunner,
): Promise<CliAgentStatus[]> {
  return Promise.all(
    CLI_AGENT_DEFS.map(async (agent) => {
      const result = await runner(agent.command, ['--version'], 10_000);
      return {
        id: agent.id,
        available: result.code === 0,
        detail:
          result.code === 0 ? result.stdout.trim().split('\n')[0] : undefined,
      };
    }),
  );
}

export async function invokeCliAgent(
  agentId: CliAgentId,
  prompt: string,
  runner: CommandRunner = defaultCommandRunner,
): Promise<{ via: string; text: string }> {
  const agent = CLI_AGENT_DEFS.find((entry) => entry.id === agentId);
  if (!agent) {
    throw new Error(`Unknown CLI agent: ${agentId}`);
  }

  const result = await runner(agent.command, agent.runArgs(prompt), 120_000);
  if (result.code !== 0) {
    throw new Error(
      `${agent.command} exited ${result.code ?? 'crashed'}: ${result.stderr
        .trim()
        .slice(0, 300)}`,
    );
  }

  return { via: agent.id, text: result.stdout.trim() };
}

export async function invokeOpenAiCompatible(
  config: ProviderConfig,
  prompt: string,
  maxTokens: number,
  fetchImpl: typeof fetch = fetch,
): Promise<OpenAiCompatibleResult> {
  const endpoint = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;

  let response: Response;
  try {
    response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
      }),
      signal: AbortSignal.timeout(90_000),
    });
  } catch (error) {
    throw new Error(
      `Provider request failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    throw new Error(
      `Provider returned ${response.status} ${response.statusText}: ${bodyText.slice(0, 300)}`,
    );
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    model?: string;
  };
  const text = payload.choices?.[0]?.message?.content;
  if (typeof text !== 'string') {
    throw new Error(
      'Provider response did not contain choices[0].message.content',
    );
  }

  return { text, modelUsed: payload.model ?? config.model };
}

import type { PythonSidecar } from './python-sidecar';

export type SidecarHealthLogLevel = 'debug' | 'info' | 'warn' | 'error';

export type SidecarHealthLogger = (
  level: SidecarHealthLogLevel,
  event: string,
  details?: Record<string, unknown>,
) => void;

export interface PythonSidecarHealthMonitorConfig {
  checkIntervalMs: number;
  restartCooldownMs: number;
  maxConsecutiveFailures: number;
}

export const DEFAULT_PYTHON_SIDECAR_HEALTH_CONFIG: PythonSidecarHealthMonitorConfig =
  {
    checkIntervalMs: 30_000,
    restartCooldownMs: 5_000,
    maxConsecutiveFailures: 3,
  };

export type PythonSidecarHealthStatus =
  | { state: 'healthy'; failureCount: number }
  | { state: 'unhealthy'; failureCount: number; reason: string }
  | { state: 'recovering'; failureCount: number };

type RestartableSidecar = {
  probe(): Promise<{ running: boolean; message?: string }>;
  stop(): Promise<unknown>;
};

type PythonSidecarHealthMonitorOptions = {
  sidecar: Pick<PythonSidecar, 'probe' | 'stop'> | RestartableSidecar;
  config?: Partial<PythonSidecarHealthMonitorConfig>;
  log?: SidecarHealthLogger;
};

export class PythonSidecarHealthMonitor {
  private readonly sidecar: RestartableSidecar;
  private readonly config: PythonSidecarHealthMonitorConfig;
  private readonly log: SidecarHealthLogger;

  private checkTimer: ReturnType<typeof setInterval> | null = null;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private checkInFlight = false;
  private disposed = false;
  private lastRestartAt = 0;

  private failureCount = 0;
  private status: PythonSidecarHealthStatus = {
    state: 'healthy',
    failureCount: 0,
  };

  constructor(options: PythonSidecarHealthMonitorOptions) {
    this.sidecar = options.sidecar;
    this.config = {
      ...DEFAULT_PYTHON_SIDECAR_HEALTH_CONFIG,
      ...options.config,
    };
    this.log = options.log ?? (() => {});
  }

  start(): void {
    if (this.disposed || this.checkTimer) {
      return;
    }

    this.log('info', 'python.sidecar.health.monitor.started', {
      checkIntervalMs: this.config.checkIntervalMs,
      maxConsecutiveFailures: this.config.maxConsecutiveFailures,
    });

    this.checkTimer = setInterval(() => {
      void this.check();
    }, this.config.checkIntervalMs);
  }

  stop(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.stop();
    this.log('info', 'python.sidecar.health.monitor.stopped');
  }

  getStatus(): PythonSidecarHealthStatus {
    return this.status;
  }

  getFailureCount(): number {
    return this.failureCount;
  }

  resetFailureCount(): void {
    this.failureCount = 0;
    this.status = { state: 'healthy', failureCount: 0 };
  }

  async check(): Promise<void> {
    if (this.disposed || this.checkInFlight) {
      return;
    }

    this.checkInFlight = true;
    try {
      const result = await this.sidecar.probe();

      if (result.running) {
        if (this.failureCount > 0) {
          this.log('info', 'python.sidecar.health.recovered', {
            previousFailureCount: this.failureCount,
          });
        }
        this.failureCount = 0;
        this.status = { state: 'healthy', failureCount: 0 };
        return;
      }

      await this.registerFailure(result.message ?? 'sidecar is not running');
    } catch (error) {
      await this.registerFailure(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      this.checkInFlight = false;
    }
  }

  async manualRestart(): Promise<boolean> {
    const sinceLastRestart = Date.now() - this.lastRestartAt;

    if (sinceLastRestart < this.config.restartCooldownMs) {
      this.log('warn', 'python.sidecar.health.restart.cooldown_active', {
        remainingMs: this.config.restartCooldownMs - sinceLastRestart,
      });
      return false;
    }

    this.lastRestartAt = Date.now();
    this.failureCount += 1;
    this.status = { state: 'recovering', failureCount: this.failureCount };

    try {
      await this.sidecar.stop();
      const result = await this.sidecar.probe();

      if (result.running) {
        this.failureCount = 0;
        this.status = { state: 'healthy', failureCount: 0 };
        this.log('info', 'python.sidecar.health.restart.succeeded');
        return true;
      }

      this.status = {
        state: 'unhealthy',
        failureCount: this.failureCount,
        reason: result.message ?? 'restart probe did not report running',
      };
      this.log('warn', 'python.sidecar.health.restart.failed', {
        message: result.message,
      });
      return false;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.status = {
        state: 'unhealthy',
        failureCount: this.failureCount,
        reason: message,
      };
      this.log('error', 'python.sidecar.health.restart.failed', { message });
      return false;
    }
  }

  private async registerFailure(reason: string): Promise<void> {
    this.failureCount += 1;
    this.log('warn', 'python.sidecar.health.check.failed', {
      failureCount: this.failureCount,
      maxConsecutiveFailures: this.config.maxConsecutiveFailures,
      reason,
    });

    if (this.failureCount >= this.config.maxConsecutiveFailures) {
      this.scheduleRestart();
      return;
    }

    this.status = {
      state: 'unhealthy',
      failureCount: this.failureCount,
      reason,
    };
  }

  private scheduleRestart(): void {
    if (this.restartTimer || this.disposed) {
      return;
    }

    const sinceLastRestart = Date.now() - this.lastRestartAt;
    const delay = Math.max(this.config.restartCooldownMs - sinceLastRestart, 0);

    this.status = {
      state: 'recovering',
      failureCount: this.failureCount,
    };
    this.log('info', 'python.sidecar.health.restart.scheduled', {
      delayMs: delay,
    });

    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      void this.manualRestart().then((restarted) => {
        if (!restarted && !this.disposed) {
          this.failureCount = Math.max(
            this.config.maxConsecutiveFailures - 1,
            0,
          );
        }
      });
    }, delay);
  }
}

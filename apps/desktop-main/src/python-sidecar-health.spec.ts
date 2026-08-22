import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_PYTHON_SIDECAR_HEALTH_CONFIG,
  PythonSidecarHealthMonitor,
} from './python-sidecar-health';

type ProbeResult = { running: boolean; message?: string };

const createSidecarStub = () => ({
  probe: vi.fn<() => Promise<ProbeResult>>(),
  stop: vi.fn<() => Promise<unknown>>(),
});

describe('PythonSidecarHealthMonitor', () => {
  let sidecar: ReturnType<typeof createSidecarStub>;

  beforeEach(() => {
    vi.useFakeTimers();
    sidecar = createSidecarStub();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createMonitor = (
    config?: Partial<typeof DEFAULT_PYTHON_SIDECAR_HEALTH_CONFIG>,
  ) => new PythonSidecarHealthMonitor({ sidecar: sidecar as never, config });

  it('starts healthy and reports healthy after a successful check', async () => {
    sidecar.probe.mockResolvedValue({ running: true });
    const monitor = createMonitor();

    await monitor.check();

    expect(monitor.getFailureCount()).toBe(0);
    expect(monitor.getStatus()).toEqual({
      state: 'healthy',
      failureCount: 0,
    });
  });

  it('counts failures and stays unhealthy below the restart threshold', async () => {
    sidecar.probe.mockResolvedValue({
      running: false,
      message: 'not listening',
    });
    const monitor = createMonitor();

    await monitor.check();
    await monitor.check();

    expect(monitor.getFailureCount()).toBe(2);
    expect(monitor.getStatus()).toEqual({
      state: 'unhealthy',
      failureCount: 2,
      reason: 'not listening',
    });
    expect(sidecar.stop).not.toHaveBeenCalled();
  });

  it('schedules a restart once the failure threshold is reached', async () => {
    sidecar.probe
      .mockResolvedValueOnce({ running: false })
      .mockResolvedValueOnce({ running: false })
      .mockResolvedValueOnce({ running: false })
      .mockResolvedValue({ running: true });
    sidecar.stop.mockResolvedValue({ stopped: true });
    const monitor = createMonitor({ restartCooldownMs: 1_000 });

    await monitor.check();
    await monitor.check();
    await monitor.check();

    expect(monitor.getStatus().state).toBe('recovering');

    await vi.advanceTimersByTimeAsync(1_000);
    expect(sidecar.stop).toHaveBeenCalledTimes(1);

    await monitor.check();
    expect(monitor.getStatus()).toEqual({ state: 'healthy', failureCount: 0 });
  });

  it('marks unhealthy when the scheduled restart fails to bring the sidecar up', async () => {
    sidecar.probe.mockResolvedValue({ running: false });
    sidecar.stop.mockResolvedValue({ stopped: true });
    const monitor = createMonitor({ restartCooldownMs: 1_000 });

    await monitor.check();
    await monitor.check();
    await monitor.check();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(monitor.getStatus()).toMatchObject({ state: 'unhealthy' });
  });

  it('enforces the restart cooldown on manual restarts', async () => {
    sidecar.probe.mockResolvedValue({ running: true });
    const monitor = createMonitor({ restartCooldownMs: 10_000 });

    const first = await monitor.manualRestart();
    const second = await monitor.manualRestart();

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(sidecar.stop).toHaveBeenCalledTimes(1);
  });

  it('resetFailureCount clears the failure streak', async () => {
    sidecar.probe.mockResolvedValue({ running: false, message: 'down' });
    const monitor = createMonitor();

    await monitor.check();
    expect(monitor.getFailureCount()).toBe(1);

    monitor.resetFailureCount();
    expect(monitor.getFailureCount()).toBe(0);
    expect(monitor.getStatus()).toEqual({ state: 'healthy', failureCount: 0 });
  });

  it('stop and dispose prevent further checks and are idempotent', async () => {
    sidecar.probe.mockResolvedValue({ running: true });
    const monitor = createMonitor({ checkIntervalMs: 100 });

    monitor.start();
    monitor.start();
    expect(vi.getTimerCount()).toBe(1);

    monitor.dispose();
    monitor.dispose();
    expect(vi.getTimerCount()).toBe(0);

    await monitor.check();
    expect(sidecar.probe).not.toHaveBeenCalled();
  });
});

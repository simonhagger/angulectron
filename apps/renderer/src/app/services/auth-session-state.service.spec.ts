import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AUTH_BRIDGE_PROVIDER,
  AuthSessionStateService,
} from './auth-session-state.service';

const getSessionSummary = vi.fn();
const getTokenDiagnostics = vi.fn();

const createService = (bridge: unknown) => {
  TestBed.configureTestingModule({
    providers: [{ provide: AUTH_BRIDGE_PROVIDER, useValue: () => bridge }],
  });
  return TestBed.inject(AuthSessionStateService);
};

const activeBridge = () => ({
  auth: { getSessionSummary, getTokenDiagnostics },
});

const failure = (code: string, retryable: boolean) => ({
  ok: false as const,
  error: { code, message: `${code} occurred`, retryable },
});

describe('AuthSessionStateService', () => {
  let service: AuthSessionStateService;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    service = createService(activeBridge());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const flushRetries = () => vi.advanceTimersByTimeAsync(5_000);

  it('marks initialized and clears errors on first success', async () => {
    getSessionSummary.mockResolvedValue({
      ok: true,
      data: { state: 'active' },
    });
    getTokenDiagnostics.mockResolvedValue({
      ok: true,
      data: { hasAccessToken: true },
    });

    await service.ensureInitialized(true);

    expect(service.initialized()).toBe(true);
    expect(service.initializationError()).toBeNull();
    expect(getSessionSummary).toHaveBeenCalledTimes(1);
    expect(getTokenDiagnostics).toHaveBeenCalledTimes(1);
    expect(service.summary()).toEqual({ state: 'active' });
  });

  it('does not retry non-retryable typed failures', async () => {
    getSessionSummary.mockResolvedValue(failure('AUTH/DENIED', false));

    await service.ensureInitialized();

    expect(getSessionSummary).toHaveBeenCalledTimes(1);
    expect(service.initialized()).toBe(true);
    expect(service.initializationError()).toBe('AUTH/DENIED occurred');
  });

  it('retries retryable failures with bounded attempts', async () => {
    getSessionSummary
      .mockResolvedValueOnce(failure('IPC/BUSY', true))
      .mockResolvedValueOnce(failure('IPC/BUSY', true))
      .mockResolvedValue({ ok: true, data: { state: 'inactive' } });

    const pending = service.ensureInitialized();
    await flushRetries();
    await pending;

    expect(getSessionSummary).toHaveBeenCalledTimes(3);
    expect(service.initialized()).toBe(true);
    expect(service.initializationError()).toBeNull();
    expect(service.summary()).toEqual({ state: 'inactive' });
  });

  it('marks initialized after exhausting retries of retryable failures', async () => {
    getSessionSummary.mockResolvedValue(failure('IPC/TIMEOUT', true));

    const pending = service.ensureInitialized();
    await flushRetries();
    await pending;

    expect(getSessionSummary).toHaveBeenCalledTimes(3);
    expect(service.initialized()).toBe(true);
    expect(service.initializationError()).toBe('IPC/TIMEOUT occurred');
  });

  it('retries thrown bridge failures and rethrows after max attempts', async () => {
    getSessionSummary.mockRejectedValue(new Error('bridge gone'));

    const pending = service.ensureInitialized();
    const assertion = expect(pending).rejects.toThrow('bridge gone');
    await flushRetries();
    await assertion;

    expect(getSessionSummary).toHaveBeenCalledTimes(3);
    expect(service.initialized()).toBe(false);
    expect(service.initializationError()).toContain(
      'Initialization failed after 3 attempts',
    );
  });

  it('shares a single initialization flow across concurrent callers', async () => {
    getSessionSummary.mockResolvedValue({
      ok: true,
      data: { state: 'active' },
    });

    await Promise.all([
      service.ensureInitialized(),
      service.ensureInitialized(),
      service.ensureInitialized(),
    ]);

    expect(getSessionSummary).toHaveBeenCalledTimes(1);
  });

  it('reset clears session state and allows re-initialization', async () => {
    getSessionSummary.mockResolvedValue({
      ok: true,
      data: { state: 'active' },
    });
    await service.ensureInitialized();

    service.reset();

    expect(service.initialized()).toBe(false);
    expect(service.summary()).toBeNull();
    expect(service.tokenDiagnostics()).toBeNull();

    await service.ensureInitialized();
    expect(getSessionSummary).toHaveBeenCalledTimes(2);
    expect(service.initialized()).toBe(true);
  });
});

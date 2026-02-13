import { z } from 'zod';
import { ipcRenderer } from 'electron';
import { invokeIpc } from './invoke-client';

vi.mock('electron', () => ({
  ipcRenderer: {
    invoke: vi.fn(),
  },
}));

describe('invokeIpc', () => {
  const responseSchema = z
    .object({
      value: z.string(),
    })
    .strict();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns parsed success envelope when response payload matches schema', async () => {
    vi.mocked(ipcRenderer.invoke).mockResolvedValue({
      ok: true,
      data: { value: 'ok' },
    });

    const result = await invokeIpc(
      'app:get-version',
      { contractVersion: '1.0.0', correlationId: 'corr-1', payload: {} },
      'corr-1',
      responseSchema,
    );

    expect(result).toEqual({
      ok: true,
      data: { value: 'ok' },
    });
  });

  it('returns malformed-response failure with correlation id when envelope is invalid', async () => {
    vi.mocked(ipcRenderer.invoke).mockResolvedValue({ wrong: true });

    const result = await invokeIpc(
      'app:get-version',
      { contractVersion: '1.0.0', correlationId: 'corr-2', payload: {} },
      'corr-2',
      responseSchema,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('IPC_MALFORMED_RESPONSE');
      expect(result.error.correlationId).toBe('corr-2');
    }
  });

  it('returns timeout failure with correlation id when invoke exceeds timeout', async () => {
    vi.mocked(ipcRenderer.invoke).mockImplementation(
      () => new Promise(() => undefined),
    );

    const result = await invokeIpc(
      'app:get-version',
      { contractVersion: '1.0.0', correlationId: 'corr-3', payload: {} },
      'corr-3',
      responseSchema,
      1,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('IPC/TIMEOUT');
      expect(result.error.correlationId).toBe('corr-3');
    }
  });

  it('returns invoke-failed envelope with correlation id when invoke throws', async () => {
    vi.mocked(ipcRenderer.invoke).mockRejectedValue(new Error('boom'));

    const result = await invokeIpc(
      'app:get-version',
      { contractVersion: '1.0.0', correlationId: 'corr-4', payload: {} },
      'corr-4',
      responseSchema,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('IPC_INVOKE_FAILED');
      expect(result.error.correlationId).toBe('corr-4');
    }
  });
});

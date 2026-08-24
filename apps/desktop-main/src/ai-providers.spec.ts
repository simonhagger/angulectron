import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  detectCliAgents,
  invokeCliAgent,
  invokeOpenAiCompatible,
  type CommandRunResult,
} from './ai-providers';

const okRun = (stdout = '1.0.0'): (() => Promise<CommandRunResult>) =>
  vi.fn(async () => ({ code: 0, stdout, stderr: '' }));

describe('detectCliAgents', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports availability from runner exit codes', async () => {
    const runner = vi.fn(
      async (command: string): Promise<CommandRunResult> =>
        command === 'claude'
          ? { code: 0, stdout: 'claude 1.2.3\n', stderr: '' }
          : { code: -1, stdout: '', stderr: 'not found' },
    );

    const agents = await detectCliAgents(runner);

    expect(agents).toHaveLength(3);
    const claude = agents.find((agent) => agent.id === 'claude');
    expect(claude?.available).toBe(true);
    expect(claude?.detail).toBe('claude 1.2.3');
    expect(
      agents
        .filter((agent) => agent.id !== 'claude')
        .every((a) => !a.available),
    ).toBe(true);
  });
});

describe('invokeCliAgent', () => {
  it('builds agent-specific args and returns trimmed stdout', async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const runner = vi.fn(
      async (command: string, args: string[]): Promise<CommandRunResult> => {
        calls.push({ command, args });
        return { code: 0, stdout: '  answer\n', stderr: '' };
      },
    );

    const result = await invokeCliAgent('codex', 'hello world', runner);

    expect(result).toEqual({ via: 'codex', text: 'answer' });
    expect(calls[0]).toEqual({
      command: 'codex',
      args: ['exec', 'hello world'],
    });
  });

  it('throws with stderr tail on non-zero exit', async () => {
    const runner = vi.fn(
      async (): Promise<CommandRunResult> => ({
        code: 1,
        stdout: '',
        stderr: 'auth expired',
      }),
    );

    await expect(invokeCliAgent('claude', 'hi', runner)).rejects.toThrow(
      /auth expired/,
    );
  });
});

describe('invokeOpenAiCompatible', () => {
  const config = {
    baseUrl: 'https://example.test/v1/',
    model: 'test-model',
    apiKey: 'secret-key',
  };

  it('posts chat completions to the configured base URL and unwraps content', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      expect(String(url)).toBe('https://example.test/v1/chat/completions');
      return new Response(
        JSON.stringify({
          model: 'resolved-model',
          choices: [{ message: { content: 'the answer' } }],
        }),
        { status: 200 },
      );
    });

    const result = await invokeOpenAiCompatible(
      config,
      'prompt',
      64,
      fetchImpl,
    );

    expect(result.modelUsed).toBe('resolved-model');
    expect(result.text).toBe('the answer');

    const request = fetchImpl.mock.calls[0][1] as RequestInit;
    expect(request.headers).toMatchObject({
      authorization: 'Bearer secret-key',
    });
    expect(JSON.parse(String(request.body))).toMatchObject({
      model: 'test-model',
      max_tokens: 64,
    });
  });

  it('surfaces provider HTTP errors with body snippet', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('rate limited', { status: 429 }),
    );

    await expect(
      invokeOpenAiCompatible(config, 'p', 8, fetchImpl),
    ).rejects.toThrow(/429.*rate limited/);
  });

  it('rejects malformed provider payloads', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ unexpected: true }), { status: 200 }),
    );

    await expect(
      invokeOpenAiCompatible(config, 'p', 8, fetchImpl),
    ).rejects.toThrow(/choices/);
  });
});

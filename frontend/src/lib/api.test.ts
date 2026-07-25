import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import api from './api';
import { getSessionId } from './analyticsSession';

describe('api client — X-Session-Id header', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    sessionStorage.clear();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [], meta: { hasMore: false, nextCursor: null } }),
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('attaches the shared per-tab session id to every request', async () => {
    const sessionId = getSessionId();

    await api.getPosts();

    const [, options] = fetchMock.mock.calls[0];
    expect((options.headers as Record<string, string>)['X-Session-Id']).toBe(sessionId);
  });

  it('reuses the same session id across separate calls', async () => {
    await api.getPosts();
    await api.getTags();

    const first = (fetchMock.mock.calls[0][1].headers as Record<string, string>)['X-Session-Id'];
    const second = (fetchMock.mock.calls[1][1].headers as Record<string, string>)['X-Session-Id'];
    expect(first).toBe(second);
  });
});

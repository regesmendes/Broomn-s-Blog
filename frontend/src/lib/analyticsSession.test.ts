import { describe, it, expect, beforeEach } from 'vitest';
import { getSessionId } from './analyticsSession';

describe('getSessionId', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('creates and persists a session id on first read', () => {
    const id = getSessionId();
    expect(id).toBeTruthy();
    expect(sessionStorage.getItem('analyticsSessionId')).toBe(id);
  });

  it('returns the same id on subsequent reads', () => {
    const first = getSessionId();
    const second = getSessionId();
    expect(second).toBe(first);
  });
});

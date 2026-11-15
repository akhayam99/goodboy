// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { brandId } from '@goodboy/types';
import type { SessionId } from '@goodboy/types';
import { LOG_LANDING } from './logLanding';

const NORTHWIND = brandId<SessionId>({ value: 'session-northwind' });
const CASCADIA = brandId<SessionId>({ value: 'session-cascadia' });

describe('LOG_LANDING', () => {
  it('hands a landing only to the session it names, once', () => {
    LOG_LANDING.request({ sessionId: NORTHWIND });

    expect(LOG_LANDING.take({ sessionId: CASCADIA })).toBe(false);
    expect(LOG_LANDING.take({ sessionId: NORTHWIND })).toBe(true);
    expect(LOG_LANDING.take({ sessionId: NORTHWIND })).toBe(false);
  });

  it('tells a mounted log at once and stops after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = LOG_LANDING.subscribe({ listener });

    LOG_LANDING.request({ sessionId: CASCADIA });
    unsubscribe();
    LOG_LANDING.request({ sessionId: CASCADIA });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(LOG_LANDING.take({ sessionId: CASCADIA })).toBe(true);
  });
});

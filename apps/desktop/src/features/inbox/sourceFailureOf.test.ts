import { describe, expect, it } from 'vitest';
import { sourceFailureOf } from './sourceFailureOf';

describe('sourceFailureOf', () => {
  it('says a refused token and asks to reconnect, with the raw line behind details', () => {
    expect(sourceFailureOf({ name: 'Sentry', message: 'The token was refused (401).' })).toEqual({
      title: 'Sentry refused the token',
      body: 'Reconnect to continue.',
      detail: 'The token was refused (401).',
      isRefused: true,
    });
  });

  it('treats a 403 the same way', () => {
    expect(sourceFailureOf({ name: 'GitLab', message: 'Request failed (403)' }).isRefused).toBe(
      true,
    );
  });

  it('keeps Retry for a rate limit', () => {
    expect(sourceFailureOf({ name: 'Linear', message: 'HTTP 429' })).toMatchObject({
      title: 'Linear is rate limited',
      isRefused: false,
    });
  });

  it('keeps Retry for a network error and shows its reason', () => {
    expect(sourceFailureOf({ name: 'Jira', message: 'connection reset' })).toMatchObject({
      title: "Jira didn't load",
      isRefused: false,
    });
  });
});

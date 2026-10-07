// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { inboxFailureNoticeOf } from './inboxFailureNotice';

describe('inboxFailureNoticeOf', () => {
  it('has no notice when nothing failed', () => {
    expect(inboxFailureNoticeOf({ failures: [] })).toBeNull();
  });

  it('names the tool, says the reason in words and keeps the notice a permission warning', () => {
    expect(
      inboxFailureNoticeOf({
        failures: [{ name: 'Sentry', message: 'The token was refused (401).' }],
      }),
    ).toEqual({
      tone: 'warning',
      title: "Couldn't load Sentry",
      body: 'The token was refused (401).',
      detail: null,
    });
  });

  it('moves raw output behind the details and keeps a plain sentence for the body', () => {
    expect(
      inboxFailureNoticeOf({
        failures: [{ name: 'Linear', message: 'linear exited with code 1\nstderr: ECONNRESET' }],
      }),
    ).toEqual({
      tone: 'danger',
      title: "Couldn't load Linear",
      body: 'Linear answered with an error.',
      detail: 'linear exited with code 1\nstderr: ECONNRESET',
    });
  });

  it('names every tool and lists each reason in the details', () => {
    expect(
      inboxFailureNoticeOf({
        failures: [
          { name: 'Jira', message: 'Timed out' },
          { name: 'Sentry', message: 'The token was refused (401).' },
        ],
      }),
    ).toEqual({
      tone: 'danger',
      title: "Couldn't load Jira and Sentry",
      body: undefined,
      detail: 'Jira: Timed out\nSentry: The token was refused (401).',
    });
  });

  it('stays a warning only when every failure is a permission problem', () => {
    expect(
      inboxFailureNoticeOf({
        failures: [
          { name: 'Jira', message: 'Permission denied for this project.' },
          { name: 'Sentry', message: 'The token was refused (401).' },
        ],
      })?.tone,
    ).toBe('warning');
  });
});

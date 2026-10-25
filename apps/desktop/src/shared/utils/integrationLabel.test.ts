import { describe, expect, it } from 'vitest';
import { integrationLabel } from './integrationLabel';

describe('integrationLabel', () => {
  it('names each tool the way its settings page does', () => {
    expect(integrationLabel({ provider: 'github' })).toBe('GitHub');
    expect(integrationLabel({ provider: 'gitlab' })).toBe('GitLab');
    expect(integrationLabel({ provider: 'bitbucket' })).toBe('Bitbucket');
    expect(integrationLabel({ provider: 'jira' })).toBe('Jira');
    expect(integrationLabel({ provider: 'linear' })).toBe('Linear');
    expect(integrationLabel({ provider: 'sentry' })).toBe('Sentry');
    expect(integrationLabel({ provider: 'slack' })).toBe('Slack');
  });
});

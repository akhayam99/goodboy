import { describe, expect, it } from 'vitest';
import { settingsTrail } from './settingsTrail';

const trailOf = (scope: Parameters<typeof settingsTrail>[0]['scope']) =>
  settingsTrail({
    scope,
    appSection: 'general',
    workspacePage: 'review-replies',
    workspaceName: 'Harborline',
  });

describe('settingsTrail', () => {
  it('is a plain text path with no menu and no action on any segment', () => {
    const scopes = ['app', 'workspace', 'providers', 'tools'] as const;

    scopes.forEach((scope) => {
      trailOf(scope).forEach((segment) => {
        expect(segment.onSelect).toBeUndefined();
        expect(segment.menu).toBeUndefined();
      });
    });
  });

  it('names the app section after the scope', () => {
    const segments = trailOf('app');

    expect(segments.map((segment) => segment.id)).toEqual(['settings', 'scope', 'section']);
    expect(segments.map((segment) => segment.label)).toEqual(['Settings', 'App', 'General']);
  });

  it('names the workspace and its page', () => {
    const segments = trailOf('workspace');

    expect(segments.map((segment) => segment.label)).toEqual([
      'Settings',
      'Workspace · Harborline',
      'Review replies',
    ]);
  });

  it('stops at the scope for providers and tools', () => {
    expect(trailOf('providers').map((segment) => segment.id)).toEqual(['settings', 'scope']);
    expect(trailOf('tools').map((segment) => segment.id)).toEqual(['settings', 'scope']);
  });
});

import { describe, expect, it } from 'vitest';
import { settingsTrail } from './settingsTrail';

const trailOf = (scope: Parameters<typeof settingsTrail>[0]['scope'], isModelsPage = false) =>
  settingsTrail({
    scope,
    section: scope === 'workspace' ? 'review-replies' : 'general',
    pageKey: isModelsPage ? 'providers:defaults' : 'provider:anthropic',
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

  it('names the workspace scope and its page, and leaves the workspace name to the top bar', () => {
    const segments = trailOf('workspace');

    expect(segments.map((segment) => segment.label)).toEqual([
      'Settings',
      'This workspace',
      'Replies and commits',
    ]);
  });

  it('reads This workspace, Models on the Models page', () => {
    const segments = trailOf('providers', true);

    expect(segments.map((segment) => segment.label)).toEqual([
      'Settings',
      'This workspace',
      'Models',
    ]);
    expect(segments.map((segment) => segment.id)).toEqual(['settings', 'scope', 'section']);
  });

  it('keeps Settings, Providers on a provider page', () => {
    expect(trailOf('providers', false).map((segment) => segment.label)).toEqual([
      'Settings',
      'Providers',
    ]);
  });

  it('stops at the scope for providers and tools', () => {
    expect(trailOf('providers').map((segment) => segment.id)).toEqual(['settings', 'scope']);
    expect(trailOf('tools').map((segment) => segment.id)).toEqual(['settings', 'scope']);
  });
});

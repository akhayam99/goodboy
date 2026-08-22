import { describe, expect, it } from 'vitest';
import {
  buildSlackManifestUrl,
  SLACK_MANIFEST_URL_LIMIT,
  SLACK_USER_SCOPES,
} from './slackAppManifest';

type DecodedManifest = {
  readonly _metadata: { readonly major_version: number; readonly minor_version: number };
  readonly display_information: { readonly name: string };
  readonly oauth_config: { readonly scopes: Record<string, ReadonlyArray<string>> };
  readonly settings: { readonly token_rotation_enabled: boolean };
};

const decode = (url: string): DecodedManifest => {
  const encoded = new URL(url).searchParams.get('manifest_json');
  return JSON.parse(encoded ?? '{}') as DecodedManifest;
};

describe('buildSlackManifestUrl', () => {
  it('drops the manifest into the app creation flow', () => {
    const url = buildSlackManifestUrl({ userScopes: SLACK_USER_SCOPES }) ?? '';
    expect(url.startsWith('https://api.slack.com/apps?new_app=1&manifest_json=')).toBe(true);
    expect(url.length).toBeLessThan(SLACK_MANIFEST_URL_LIMIT);
  });

  it('asks for the five scopes as user scopes and for no bot scope at all', () => {
    const url = buildSlackManifestUrl({ userScopes: SLACK_USER_SCOPES });
    const manifest = decode(url ?? '');
    expect(manifest.oauth_config.scopes.user).toEqual([
      'channels:read',
      'channels:history',
      'users:read',
      'chat:write',
      'reactions:write',
    ]);
    expect(Object.keys(manifest.oauth_config.scopes)).toEqual(['user']);
  });

  it('targets the current manifest schema and keeps the pasted token valid', () => {
    const manifest = decode(buildSlackManifestUrl({ userScopes: SLACK_USER_SCOPES }) ?? '');
    expect(manifest._metadata).toEqual({ major_version: 2, minor_version: 1 });
    expect(manifest.display_information.name).toBe('Goodboy');
    expect(manifest.settings.token_rotation_enabled).toBe(false);
  });

  it('gives up on the url when the manifest outgrows what a url can carry', () => {
    const oversized = Array.from({ length: 400 }, (_, index) => `scope:${index}`.padEnd(40, 'x'));
    expect(buildSlackManifestUrl({ userScopes: oversized })).toBeNull();
  });
});

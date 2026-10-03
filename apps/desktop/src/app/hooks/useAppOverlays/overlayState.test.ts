// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { footerTarget, type ConnectedIntegrations, type FooterTarget } from './overlayState';
import type { StudioPlace } from '../../../store';

const NONE_CONNECTED: ConnectedIntegrations = {
  github: false,
  gitlab: false,
  bitbucket: false,
  linear: false,
  jira: false,
  sentry: false,
  slack: false,
};

const GITHUB_CONNECTED: ConnectedIntegrations = { ...NONE_CONNECTED, github: true };

const inboxOn = (provider: 'github' | 'linear'): StudioPlace => ({
  kind: 'inbox',
  focus: { provider, kind: null, recordKey: null, sessionId: null },
});

type Expected = {
  readonly place: FooterTarget['place'];
  readonly tool: FooterTarget['tool'];
};

const at = (place: FooterTarget['place'], tool: FooterTarget['tool'] = null): Expected => ({
  place,
  tool,
});

const CASES: ReadonlyArray<readonly [string, StudioPlace | null, Expected]> = [
  ['nothing open', null, at(null)],
  ['app settings', { kind: 'settings', focus: { scope: 'app' } }, at('settings')],
  ['workspace settings', { kind: 'settings', focus: { scope: 'workspace' } }, at('settings')],
  ['providers settings', { kind: 'settings', focus: { scope: 'providers' } }, at('settings')],
  [
    'tools settings without a tool',
    { kind: 'settings', focus: { scope: 'tools' } },
    at('settings'),
  ],
  [
    'tools settings on a disconnected tool',
    { kind: 'settings', focus: { scope: 'tools', tool: 'linear' } },
    at('link'),
  ],
  [
    'tools settings on a connected tool',
    { kind: 'settings', focus: { scope: 'tools', tool: 'github' } },
    at('settings'),
  ],
  ['the whole inbox', { kind: 'inbox', focus: null }, at('inbox')],
  ['the inbox on a connected glyph', inboxOn('github'), at('inbox', 'github')],
  ['the inbox on a disconnected provider', inboxOn('linear'), at('inbox')],
  ['workflows', { kind: 'workflow' }, at('workflows')],
  ['impact', { kind: 'impact', scope: null }, at('impact')],
  ['changelog', { kind: 'changelog' }, at('changelog')],
  ['guide', { kind: 'guide' }, at(null)],
  ['companion', { kind: 'companion' }, at(null)],
  ['add workspace', { kind: 'addWorkspace' }, at(null)],
  ['notifications', { kind: 'notifications' }, at(null)],
];

describe('footerTarget', () => {
  it.each(CASES)('lights the right controls for %s', (_name, overlay, expected) => {
    expect(footerTarget({ overlay, connected: GITHUB_CONNECTED })).toEqual(expected);
  });

  it('keeps the inbox lit while the glyph of the chosen tool is the only extra', () => {
    const target = footerTarget({ overlay: inboxOn('github'), connected: GITHUB_CONNECTED });

    expect(target.place).toBe('inbox');
    expect(target.tool).toBe('github');
  });
});

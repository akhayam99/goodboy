import { describe, expect, it } from 'vitest';
import {
  footerTarget,
  type ConnectedIntegrations,
  type FooterTarget,
  type Overlay,
} from './overlayState';

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

const inboxOn = (provider: 'github' | 'linear'): Overlay => ({
  kind: 'inbox',
  focus: { provider, kind: null, recordKey: null, sessionId: null },
});

const CASES: ReadonlyArray<readonly [string, Overlay | null, FooterTarget]> = [
  ['nothing open', null, null],
  ['app settings', { kind: 'settings', focus: { scope: 'app' } }, 'settings'],
  ['workspace settings', { kind: 'settings', focus: { scope: 'workspace' } }, 'settings'],
  ['providers settings', { kind: 'settings', focus: { scope: 'providers' } }, 'providers'],
  ['tools settings without a tool', { kind: 'settings', focus: { scope: 'tools' } }, 'settings'],
  [
    'tools settings on a disconnected tool',
    { kind: 'settings', focus: { scope: 'tools', tool: 'linear' } },
    'link',
  ],
  [
    'tools settings on a connected tool',
    { kind: 'settings', focus: { scope: 'tools', tool: 'github' } },
    'settings',
  ],
  ['the whole inbox', { kind: 'inbox', focus: null }, 'inbox'],
  ['the inbox on a connected glyph', inboxOn('github'), 'github'],
  ['the inbox on a disconnected provider', inboxOn('linear'), 'inbox'],
  ['workflows', { kind: 'workflow' }, 'workflows'],
  ['impact', { kind: 'impact', scope: null }, 'impact'],
  ['changelog', { kind: 'changelog' }, 'changelog'],
  ['guide', { kind: 'guide' }, null],
  ['report', { kind: 'report' }, null],
  ['companion', { kind: 'companion' }, null],
  ['add workspace', { kind: 'addWorkspace' }, null],
  ['notifications', { kind: 'notifications' }, null],
];

describe('footerTarget', () => {
  it.each(CASES)('lights the right control for %s', (_name, overlay, expected) => {
    expect(footerTarget({ overlay, connected: GITHUB_CONNECTED })).toBe(expected);
  });
});

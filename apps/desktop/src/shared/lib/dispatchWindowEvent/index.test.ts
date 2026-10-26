// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { openSettings } from '../../../features/settings/openSettings';
import { dispatchWindowEvent } from './index';

const listener = vi.fn<(event: Event) => void>();

afterEach(() => {
  window.removeEventListener('goodboy:new-session', listener);
  window.removeEventListener('goodboy:open-settings', listener);
  window.removeEventListener('goodboy:open-inbox', listener);
  listener.mockClear();
});

const lastDetail = (): unknown => {
  const event = listener.mock.calls.at(-1)?.[0];
  return event instanceof CustomEvent ? event.detail : undefined;
};

describe('dispatchWindowEvent', () => {
  it('sends the named event on the window with no detail', () => {
    window.addEventListener('goodboy:new-session', listener);
    dispatchWindowEvent({ name: 'goodboy:new-session' });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(lastDetail()).toBeNull();
  });

  it('carries the detail it was given', () => {
    window.addEventListener('goodboy:open-inbox', listener);
    dispatchWindowEvent({ name: 'goodboy:open-inbox', detail: { provider: 'sentry', door: true } });
    expect(lastDetail()).toEqual({ provider: 'sentry', door: true });
  });
});

describe('openSettings', () => {
  it('sends the settings studio event with only the keys it was given', () => {
    window.addEventListener('goodboy:open-settings', listener);
    openSettings({ scope: 'workspace', section: 'projects' });
    expect(lastDetail()).toStrictEqual({ scope: 'workspace', section: 'projects' });
  });

  it('keeps the door flag and the provider action for a replace-and-install call', () => {
    window.addEventListener('goodboy:open-settings', listener);
    openSettings({ scope: 'providers', provider: 'anthropic', action: 'install', door: true });
    expect(lastDetail()).toStrictEqual({
      scope: 'providers',
      provider: 'anthropic',
      action: 'install',
      door: true,
    });
  });
});

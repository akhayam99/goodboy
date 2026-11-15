// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { settingsOverlayFromEvent } from './eventDetail';

type EventParams = {
  readonly detail: unknown;
};

const settingsEvent = ({ detail }: EventParams): Event =>
  new CustomEvent('goodboy:open-settings', { detail });

describe('settingsOverlayFromEvent', () => {
  it('carries the row a setting search picked', () => {
    expect(
      settingsOverlayFromEvent(
        settingsEvent({ detail: { scope: 'app', section: 'general', row: 'theme' } }),
      ),
    ).toEqual({
      kind: 'settings',
      focus: { scope: 'app', section: 'general', flow: undefined, row: 'theme' },
    });
  });

  it('leaves the row out when the event names none', () => {
    const studio = settingsOverlayFromEvent(settingsEvent({ detail: { scope: 'workspace' } }));

    expect(studio.kind === 'settings' && 'row' in studio.focus).toBe(false);
  });
});

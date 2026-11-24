// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { IMPACT_STUDIO_EVENT, openImpactStudio } from '../../../features/impact/openImpactStudio';
import { impactOverlayFromEvent, settingsOverlayFromEvent } from './eventDetail';

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

describe('impactOverlayFromEvent', () => {
  it('opens the agents tab the public helper asks for', () => {
    const seen: Array<Event> = [];
    const listen = (event: Event) => seen.push(event);
    window.addEventListener(IMPACT_STUDIO_EVENT, listen);
    openImpactStudio({ scope: { kind: 'agents' } });
    window.removeEventListener(IMPACT_STUDIO_EVENT, listen);

    expect(seen.map((event) => impactOverlayFromEvent(event))).toEqual([
      { kind: 'impact', scope: { kind: 'agents' } },
    ]);
  });
});

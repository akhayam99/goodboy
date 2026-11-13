import { describe, expect, it } from 'vitest';
import { actionButtonStateOf } from './actionButtonStateOf';
import { pendingSecondsOf } from './pendingSecondsOf';
import type { ActionControls } from './useActionControls';

const STARTED_AT = Date.parse('2026-11-09T10:00:00.000Z');

describe('pendingSecondsOf', () => {
  it('says nothing for the first three seconds, then counts whole seconds', () => {
    expect(pendingSecondsOf({ startedAt: STARTED_AT, now: STARTED_AT + 2_999 })).toBeNull();
    expect(pendingSecondsOf({ startedAt: STARTED_AT, now: STARTED_AT + 3_000 })).toBe(3);
    expect(pendingSecondsOf({ startedAt: STARTED_AT, now: STARTED_AT + 7_400 })).toBe(7);
  });

  it('says nothing when no run is pending', () => {
    expect(pendingSecondsOf({ startedAt: null, now: STARTED_AT })).toBeNull();
  });
});

type ControlsParams = {
  readonly pendingSeconds: number | null;
};

const controlsOf = ({ pendingSeconds }: ControlsParams): ActionControls => ({
  target: null,
  actions: [],
  inSlot: () => [],
  pendingId: 'pullRequest.merge',
  pendingSeconds,
  confirming: null,
  failure: null,
  outcome: null,
  trigger: () => undefined,
  confirm: async () => undefined,
  cancel: () => undefined,
  retry: () => undefined,
  dismissFailure: () => undefined,
  dismissOutcome: () => undefined,
});

describe('actionButtonStateOf', () => {
  it('adds the elapsed seconds to the busy word of a slow run', () => {
    expect(
      actionButtonStateOf({
        controls: controlsOf({ pendingSeconds: 7 }),
        actionId: 'pullRequest.merge',
        label: 'Merge',
        pendingLabel: 'Merging…',
      }),
    ).toEqual({ isPending: true, isBusy: true, label: 'Merging… 7s' });
  });

  it('keeps the plain busy word for a quick run and the label for another action', () => {
    const controls = controlsOf({ pendingSeconds: null });
    expect(
      actionButtonStateOf({
        controls,
        actionId: 'pullRequest.merge',
        label: 'Merge',
        pendingLabel: 'Merging…',
      }).label,
    ).toBe('Merging…');
    expect(
      actionButtonStateOf({
        controls,
        actionId: 'pullRequest.close',
        label: 'Close pull request',
        pendingLabel: 'Closing…',
      }),
    ).toEqual({ isPending: false, isBusy: false, label: 'Close pull request' });
  });
});

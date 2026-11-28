import { useCallQuietStore } from '../../notifications/away/callQuietStore';
import { joinCall } from '../joinCall';
import { callChipCommands } from './callChipCommands';
import { useCallChipStore } from './callChipStore';
import type { ChipEffect, ChipInput } from './callChipTypes';
import { reduceCallChip } from './reduceCallChip';
import { reportChipError } from './reportChipError';

type Params = {
  readonly input: ChipInput;
  readonly now: number;
};

type EffectParams = {
  readonly effect: ChipEffect;
};

const runEffect = ({ effect }: EffectParams): void => {
  if (effect.kind === 'open-link') {
    const { call } = effect;
    void joinCall({ link: call.link }).then((isOpened) => {
      if (isOpened) {
        applyChipInput({ input: { kind: 'joined', call }, now: Date.now() });
      }
    });
    return;
  }
  if (effect.kind === 'quiet') {
    useCallQuietStore
      .getState()
      .startQuiet({ quiet: { eventId: effect.eventId, until: effect.until } });
    return;
  }
  const { eventId, at } = effect;
  callChipCommands
    .snooze({ eventId, at })
    .then((isArmed) => {
      if (!isArmed) {
        throw new Error('This call is no longer on your calendar.');
      }
      applyChipInput({ input: { kind: 'snoozed', eventId, until: at }, now: Date.now() });
    })
    .catch((error: unknown) => reportChipError({ title: "Couldn't snooze the call", error }));
};

export const applyChipInput = ({ input, now }: Params): void => {
  const reduced = reduceCallChip({ state: useCallChipStore.getState().state, input, now });
  useCallChipStore.setState({ state: reduced.state });
  for (const effect of reduced.effects) {
    runEffect({ effect });
  }
};

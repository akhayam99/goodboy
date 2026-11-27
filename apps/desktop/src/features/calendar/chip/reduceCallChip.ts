import type { ChipCall, ChipEffect, ChipInput, ChipState } from './callChipTypes';

const SNOOZE_MS = 5 * 60_000;

type Params = {
  readonly state: ChipState;
  readonly input: ChipInput;
  readonly now: number;
};

type Reduced = Readonly<{
  state: ChipState;
  effects: ReadonlyArray<ChipEffect>;
}>;

type StateParams = {
  readonly state: ChipState;
};

type InCallParams = StateParams & {
  readonly call: ChipCall;
};

type JoinParams = {
  readonly call: ChipCall;
  readonly now: number;
};

const HIDDEN: ChipState = { kind: 'hidden' };

const stay = ({ state }: StateParams): Reduced => ({ state, effects: [] });

const isInCallWith = ({ state, call }: InCallParams): boolean =>
  (state.kind === 'in-call' || state.kind === 'after') && state.call.id === call.id;

const join = ({ call, now }: JoinParams): Reduced => ({
  state: { kind: 'in-call', call, joinedAt: now },
  effects: [
    { kind: 'open-link', link: call.link },
    { kind: 'quiet', eventId: call.id, until: call.end },
  ],
});

export const reduceCallChip = ({ state, input, now }: Params): Reduced => {
  if (input.kind === 'alert') {
    if (input.moment === 'ended' || now >= input.call.end) {
      return stay({ state });
    }
    if (isInCallWith({ state, call: input.call })) {
      return stay({ state });
    }
    if (input.moment === 'five-minutes') {
      return stay({ state: { kind: 'soon', call: input.call } });
    }
    return stay({ state: { kind: 'countdown', call: input.call } });
  }
  if (input.kind === 'ended') {
    if (state.kind === 'hidden' || state.call.id !== input.call.id) {
      return stay({ state });
    }
    if (state.kind !== 'in-call' || input.held.length === 0) {
      return stay({ state: HIDDEN });
    }
    return stay({
      state: { kind: 'after', call: state.call, joinedAt: state.joinedAt, held: input.held },
    });
  }
  if (input.kind === 'hide') {
    return stay({ state: HIDDEN });
  }
  if (state.kind === 'hidden' || state.kind === 'after') {
    return stay({ state });
  }
  const { call } = state;
  if (input.kind === 'return') {
    if (state.kind !== 'in-call') {
      return stay({ state });
    }
    return { state, effects: [{ kind: 'open-link', link: call.link }] };
  }
  if (state.kind === 'in-call') {
    return stay({ state });
  }
  if (input.kind === 'snooze') {
    return { state, effects: [{ kind: 'snooze', eventId: call.id, at: now + SNOOZE_MS }] };
  }
  if (input.kind === 'snoozed') {
    if (input.eventId !== call.id) {
      return stay({ state });
    }
    return stay({ state: { kind: 'snoozed', call, until: input.until } });
  }
  if (call.isLinkTrusted || state.kind === 'check-link') {
    return join({ call, now });
  }
  return stay({ state: { kind: 'check-link', call } });
};

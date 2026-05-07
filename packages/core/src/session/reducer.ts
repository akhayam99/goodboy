import type { IsoDateTime, ProviderRunId, SessionState, TurnEvent } from '@kay-am/types';

export type SessionEvent =
  | { kind: 'start'; at: IsoDateTime }
  | { kind: 'send'; runId: ProviderRunId; at: IsoDateTime }
  | { kind: 'receive_event'; event: TurnEvent }
  | { kind: 'end'; at: IsoDateTime }
  | { kind: 'error'; message: string; at: IsoDateTime }
  | { kind: 'retry'; at: IsoDateTime };

export class IllegalSessionTransitionError extends Error {
  constructor(
    public readonly state: SessionState,
    public readonly event: SessionEvent,
  ) {
    super(`illegal transition: cannot apply ${event.kind} in state ${state.kind}`);
    this.name = 'IllegalSessionTransitionError';
  }
}

export function sessionReducer(state: SessionState, event: SessionEvent): SessionState {
  switch (event.kind) {
    case 'start':
      if (state.kind !== 'draft') {
        throw new IllegalSessionTransitionError(state, event);
      }
      return { kind: 'starting', startedAt: event.at };

    case 'send':
      if (state.kind !== 'starting' && state.kind !== 'idle') {
        throw new IllegalSessionTransitionError(state, event);
      }
      return { kind: 'running', runId: event.runId, startedAt: event.at };

    case 'receive_event': {
      if (state.kind !== 'running') {
        throw new IllegalSessionTransitionError(state, event);
      }
      return applyTurnEvent(state, event.event);
    }

    case 'end':
      if (state.kind === 'ended') {
        throw new IllegalSessionTransitionError(state, event);
      }
      return { kind: 'ended', endedAt: event.at };

    case 'error':
      if (state.kind === 'ended') {
        throw new IllegalSessionTransitionError(state, event);
      }
      return { kind: 'error', message: event.message, failedAt: event.at };

    case 'retry':
      if (state.kind !== 'error') {
        throw new IllegalSessionTransitionError(state, event);
      }
      return { kind: 'idle', lastActivityAt: event.at };

    default: {
      const _exhaustive: never = event;
      throw new Error(`unhandled session event: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

function applyTurnEvent(state: SessionState, turn: TurnEvent): SessionState {
  switch (turn.kind) {
    case 'done':
      return { kind: 'idle', lastActivityAt: turn.at };
    case 'error':
      return { kind: 'error', message: turn.message, failedAt: turn.at };
    case 'assistant_text':
    case 'tool_call_start':
    case 'tool_call_end':
    case 'file_edit':
    case 'usage':
      return state;
    default: {
      const _exhaustive: never = turn;
      throw new Error(`unhandled turn event: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

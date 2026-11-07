import type { SessionId } from '@goodboy/types';
import { checkChainActionOf } from '../../branch/checks/checkChainActionOf';
import type { SessionSuggestion } from '../types';
import type { SuggestionActions } from '.';

type FixChecksPayload = Extract<SessionSuggestion, { readonly kind: 'fix-checks' }>['payload'];

type Params = {
  readonly sessionId: SessionId;
  readonly payload: FixChecksPayload;
  readonly lock: string | null;
};

export const fixChecksActions = ({ sessionId, payload, lock }: Params): SuggestionActions => {
  const action = checkChainActionOf({
    sessionId,
    mountId: payload.mountId,
    prNumber: payload.prNumber,
    chain: payload.progress?.chain ?? 'none',
  });
  const blocked = {
    isDisabled: lock !== null,
    ...(lock !== null && { blockedReason: lock }),
  };
  if (action.kind === 'startFix') {
    return {
      primary: {
        label: 'Start fix',
        agentKind: 'implementer',
        ...blocked,
        failureTitle: action.failureTitle,
        run: () => action.run({}),
      },
      onDismiss: null,
    };
  }
  if (action.kind === 'push') {
    return {
      primary: {
        label: 'Push',
        isDisabled: false,
        failureTitle: action.failureTitle,
        run: () => action.run({}),
      },
      onDismiss: null,
    };
  }
  return {
    primary: {
      label: action.isAgain ? 'Analyze again' : 'Analyze',
      agentKind: 'debugger',
      ...blocked,
      failureTitle: action.failureTitle,
      run: () => action.run({}),
    },
    onDismiss: null,
  };
};

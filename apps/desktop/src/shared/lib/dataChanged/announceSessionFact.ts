import type { SessionId } from '@goodboy/types';
import { announceDataChanged, type SessionFactKind } from './index';

type Params = {
  readonly kind: SessionFactKind;
  readonly sessionId: SessionId;
};

export const announceSessionFact = ({ kind, sessionId }: Params): void => {
  announceDataChanged({ change: { kind, sessionId } }).catch((error: unknown) =>
    console.warn('telling the other windows failed', error),
  );
};

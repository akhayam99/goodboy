import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { IsoDateTime, SessionId } from '@goodboy/types';
import {
  deleteNudgeEvent,
  insertNudgeEvent,
  listNudgeEvents,
  type NudgeOutcome,
} from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { NextStepOutcome } from '../nextStepGates';
import {
  dismissedFingerprintsFromEvents,
  nextStepNudgeKind,
  toNextStepOutcomes,
} from '../nextStepOutcomes';
import type { SuggestionKind } from '../types';
import { OUTCOME_REVISIONS } from './outcomeRevisions';

const EPOCH: IsoDateTime = new Date(0).toISOString() as IsoDateTime;

type Params = {
  readonly sessionId: SessionId;
};

export type NextStepGateState = {
  readonly outcomes: ReadonlyArray<NextStepOutcome>;
  readonly dismissedFingerprints: ReadonlySet<string>;
  readonly loadedFor: SessionId | null;
};

const EMPTY_OUTCOMES: ReadonlyArray<NextStepOutcome> = [];

const EMPTY_GATE_STATE: NextStepGateState = {
  outcomes: EMPTY_OUTCOMES,
  dismissedFingerprints: new Set<string>(),
  loadedFor: null,
};

export const useNextStepOutcomes = ({ sessionId }: Params): NextStepGateState => {
  const [state, setState] = useState<NextStepGateState>(EMPTY_GATE_STATE);
  const watch = useCallback(
    (listener: () => void) => OUTCOME_REVISIONS.subscribe({ sessionId, listener }),
    [sessionId],
  );
  const revision = useSyncExternalStore(watch, () => OUTCOME_REVISIONS.read({ sessionId }));

  useEffect(() => {
    let isStale = false;
    listNudgeEvents({ db: tauriDatabase, sessionId, sinceTs: EPOCH })
      .then((events) => {
        if (isStale) {
          return;
        }
        setState({
          outcomes: toNextStepOutcomes({ events }),
          dismissedFingerprints: dismissedFingerprintsFromEvents({ events }),
          loadedFor: sessionId,
        });
      })
      .catch(() => undefined);
    return () => {
      isStale = true;
    };
  }, [sessionId, revision]);

  return state;
};

type RecordParams = {
  readonly sessionId: SessionId;
  readonly kind: SuggestionKind;
  readonly outcome: NudgeOutcome;
  readonly fingerprint?: string;
};

export const recordNextStepOutcome = async ({
  sessionId,
  kind,
  outcome,
  fingerprint,
}: RecordParams): Promise<string | null> => {
  const now = new Date().toISOString() as IsoDateTime;
  const id = crypto.randomUUID();
  try {
    await insertNudgeEvent(tauriDatabase, {
      id,
      sessionId,
      ts: now,
      kind: nextStepNudgeKind({ kind }),
      contextJson: fingerprint == null ? null : JSON.stringify({ fingerprint }),
      outcome,
      outcomeTs: now,
    });
    OUTCOME_REVISIONS.bump({ sessionId });
    return id;
  } catch {
    return null;
  }
};

type RevertParams = {
  readonly sessionId: SessionId;
  readonly id: string;
};

export const revertNextStepOutcome = async ({ sessionId, id }: RevertParams): Promise<void> => {
  await deleteNudgeEvent({ db: tauriDatabase, sessionId, id });
  OUTCOME_REVISIONS.bump({ sessionId });
};

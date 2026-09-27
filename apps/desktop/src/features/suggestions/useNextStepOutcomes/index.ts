import { useEffect, useState } from 'react';
import type { IsoDateTime, SessionId } from '@goodboy/types';
import { insertNudgeEvent, listNudgeEvents, type NudgeOutcome } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { NextStepOutcome } from '../nextStepGates';
import {
  dismissedFingerprintsFromEvents,
  nextStepNudgeKind,
  toNextStepOutcomes,
} from '../nextStepOutcomes';
import type { SuggestionKind } from '../types';

const EPOCH: IsoDateTime = new Date(0).toISOString() as IsoDateTime;

type Params = {
  readonly sessionId: SessionId;
};

export type NextStepGateState = {
  readonly outcomes: ReadonlyArray<NextStepOutcome>;
  readonly dismissedFingerprints: ReadonlySet<string>;
};

const EMPTY_OUTCOMES: ReadonlyArray<NextStepOutcome> = [];

const EMPTY_GATE_STATE: NextStepGateState = {
  outcomes: EMPTY_OUTCOMES,
  dismissedFingerprints: new Set<string>(),
};

export const useNextStepOutcomes = ({ sessionId }: Params): NextStepGateState => {
  const [state, setState] = useState<NextStepGateState>(EMPTY_GATE_STATE);

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
        });
      })
      .catch(() => undefined);
    return () => {
      isStale = true;
    };
  }, [sessionId]);

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
}: RecordParams): Promise<void> => {
  const now = new Date().toISOString() as IsoDateTime;
  try {
    await insertNudgeEvent(tauriDatabase, {
      id: crypto.randomUUID(),
      sessionId,
      ts: now,
      kind: nextStepNudgeKind({ kind }),
      contextJson: fingerprint == null ? null : JSON.stringify({ fingerprint }),
      outcome,
      outcomeTs: now,
    });
  } catch {
    return;
  }
};

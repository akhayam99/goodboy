import { useEffect, useState } from 'react';
import type { IsoDateTime, SessionId } from '@goodboy/types';
import { insertNudgeEvent, listNudgeEvents, type NudgeOutcome } from '@goodboy/db';
import { EMPTY_ARRAY } from '../../../store';
import { tauriDatabase } from '../../../shared/lib/db';
import type { NextStepOutcome } from '../nextStepGates';
import { nextStepNudgeKind, toNextStepOutcomes } from '../nextStepOutcomes';
import type { SuggestionKind } from '../types';

const WINDOW_DAYS = 14;
const WINDOW_MS = WINDOW_DAYS * 24 * 60 * 60 * 1_000;

type Params = {
  readonly sessionId: SessionId;
};

export const useNextStepOutcomes = ({ sessionId }: Params): ReadonlyArray<NextStepOutcome> => {
  const [outcomes, setOutcomes] = useState<ReadonlyArray<NextStepOutcome>>(
    EMPTY_ARRAY as ReadonlyArray<NextStepOutcome>,
  );

  useEffect(() => {
    let isStale = false;
    const sinceTs = new Date(Date.now() - WINDOW_MS).toISOString() as IsoDateTime;
    listNudgeEvents({ db: tauriDatabase, sessionId, sinceTs })
      .then((events) => {
        if (isStale) {
          return;
        }
        setOutcomes(toNextStepOutcomes({ events }));
      })
      .catch(() => undefined);
    return () => {
      isStale = true;
    };
  }, [sessionId]);

  return outcomes;
};

type RecordParams = {
  readonly sessionId: SessionId;
  readonly kind: SuggestionKind;
  readonly outcome: NudgeOutcome;
};

export const recordNextStepOutcome = async ({
  sessionId,
  kind,
  outcome,
}: RecordParams): Promise<void> => {
  const now = new Date().toISOString() as IsoDateTime;
  try {
    await insertNudgeEvent(tauriDatabase, {
      id: crypto.randomUUID(),
      sessionId,
      ts: now,
      kind: nextStepNudgeKind({ kind }),
      contextJson: null,
      outcome,
      outcomeTs: now,
    });
  } catch {
    return;
  }
};

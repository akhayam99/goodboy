import { insertNudgeEvent, type NudgeEvent, type NudgeKind } from '@goodboy/db';
import { formatError } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { nowIso } from '../project-mounts/nowIso';

type Params = {
  readonly kind: NudgeKind;
  readonly sessionId: SessionId;
  readonly context: Record<string, unknown>;
};

export const recordNudgeShown = async ({ kind, sessionId, context }: Params): Promise<string> => {
  const id = crypto.randomUUID();
  const event = {
    id,
    sessionId,
    ts: nowIso({}),
    kind,
    contextJson: JSON.stringify(context),
    outcome: null,
    outcomeTs: null,
  } satisfies NudgeEvent;
  try {
    await insertNudgeEvent(tauriDatabase, event);
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn(`[nudge-event] insert failed: ${formatError(err)}`);
    }
  }
  return id;
};

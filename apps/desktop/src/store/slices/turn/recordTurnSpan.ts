import { insertAgentTurnSpan } from '@goodboy/db';
import type { AgentTurnSpan } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn } from '../../slice-types';

type Params = {
  readonly span: AgentTurnSpan;
  readonly get: GetFn;
};

export const recordTurnSpan = async ({ span, get }: Params): Promise<void> => {
  try {
    await insertAgentTurnSpan({ db: tauriDatabase, span });
  } catch (error) {
    console.error('agent turn span write failed', error);
    return;
  }
  await get().refreshTurnSpans({ sessionId: span.sessionId, workspaceId: span.workspaceId });
};

import { insertAgentTurnSpan } from '@goodboy/db';
import type { AgentTurnSpan } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';

type Params = {
  readonly span: AgentTurnSpan;
};

export const recordTurnSpan = async ({ span }: Params): Promise<void> => {
  try {
    await insertAgentTurnSpan({ db: tauriDatabase, span });
  } catch (error) {
    console.error('agent turn span write failed', error);
  }
};

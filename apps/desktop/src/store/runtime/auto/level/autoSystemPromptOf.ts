import { AUTO_GATES, buildAutoSystemPrompt } from '@goodboy/core';
import type { SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../../shared/lib/db';
import { readAutoLevel } from './readAutoLevel';

type Params = {
  readonly sessionId: SessionId;
};

export const autoSystemPromptOf = async ({ sessionId }: Params): Promise<string> => {
  const level = await readAutoLevel({ db: tauriDatabase, target: { sessionId } });
  return buildAutoSystemPrompt({ isDelegationEnabled: AUTO_GATES.isDelegationEnabled, level });
};

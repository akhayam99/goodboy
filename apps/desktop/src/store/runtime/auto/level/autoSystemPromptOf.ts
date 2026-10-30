import { AUTO_GATES, buildAutoSystemPrompt } from '@goodboy/core';
import { getSessionById } from '@goodboy/db';
import type { AgentId, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../../shared/lib/db';
import { readRunGuidance } from '../../runGuidance/readRunGuidance';
import { readAutoLevel } from './readAutoLevel';

type Params = {
  readonly sessionId: SessionId;
  readonly agentId?: AgentId | null;
  readonly languageAnchor?: string;
};

export const autoSystemPromptOf = async ({
  sessionId,
  agentId = null,
  languageAnchor = '',
}: Params): Promise<string> => {
  const level = await readAutoLevel({ db: tauriDatabase, target: { sessionId } });
  const session = agentId === null ? null : await getSessionById(tauriDatabase, sessionId);
  const guidance =
    agentId === null || session === null
      ? null
      : await readRunGuidance({ db: tauriDatabase, workspaceId: session.workspaceId, agentId });
  return buildAutoSystemPrompt({
    isDelegationEnabled: AUTO_GATES.isDelegationEnabled,
    level,
    guidance,
    languageAnchor,
  });
};

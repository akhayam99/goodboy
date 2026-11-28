import { AUTO_GATES, buildAutoSystemPrompt } from '@goodboy/core/auto';
import { getAutoTreeByRootAgent, getSessionById } from '@goodboy/db';
import type { PreferredLanguage } from '@goodboy/core/language';
import type { AgentId, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../../shared/lib/db';
import { ensureRunGuide } from '../../runGuide/ensureRunGuide';
import { readRunGuidance } from '../../runGuidance/readRunGuidance';
import { readAutoLevel } from './readAutoLevel';
import { readIsLeadClosing } from './readIsLeadClosing';

type Params = {
  readonly sessionId: SessionId;
  readonly agentId?: AgentId | null;
  readonly languageAnchor?: string;
  readonly preferredLanguage?: PreferredLanguage | null;
};

export const autoSystemPromptOf = async ({
  sessionId,
  agentId = null,
  languageAnchor = '',
  preferredLanguage = null,
}: Params): Promise<string> => {
  const level = await readAutoLevel({ db: tauriDatabase, target: { sessionId } });
  const session = agentId === null ? null : await getSessionById(tauriDatabase, sessionId);
  const guidance =
    agentId === null || session === null
      ? null
      : await readRunGuidance({ db: tauriDatabase, workspaceId: session.workspaceId, agentId });
  const tree =
    agentId === null
      ? null
      : await getAutoTreeByRootAgent({ db: tauriDatabase, rootAgentId: agentId });
  const isLeadClosing =
    tree === null ? false : await readIsLeadClosing({ db: tauriDatabase, treeId: tree.id });
  const guide = tree === null ? null : await ensureRunGuide({ db: tauriDatabase, treeId: tree.id });
  return buildAutoSystemPrompt({
    isDelegationEnabled: AUTO_GATES.isDelegationEnabled,
    level,
    guidance,
    languageAnchor,
    preferredLanguage,
    isLeadClosing,
    guide,
  });
};

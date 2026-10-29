import { AUTO_GATES, buildAutoSystemPrompt } from '@goodboy/core';
import type { SessionId } from '@goodboy/types';
import { AGENT_KIND_DEFAULTS, type AgentKind } from '../../../features/session/agent-kind';
import { tauriDatabase } from '../../../shared/lib/db';
import { readAutoLevel } from '../../runtime/auto/level/readAutoLevel';

type Params = {
  readonly kind: AgentKind;
  readonly sessionId: SessionId;
};

export const kindSystemPromptOf = async ({
  kind,
  sessionId,
}: Params): Promise<string | undefined> => {
  if (kind !== 'auto') {
    return AGENT_KIND_DEFAULTS[kind].systemPrompt;
  }
  const level = await readAutoLevel({ db: tauriDatabase, target: { sessionId } });
  return buildAutoSystemPrompt({ isDelegationEnabled: AUTO_GATES.isDelegationEnabled, level });
};

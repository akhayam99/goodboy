import { useCallback } from 'react';
import type { SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { useToast } from '../../../../shared/components/Toast';
import { classifyAgent, type AgentKind } from '../../../session/agent-kind';
import type { DiffLineTarget } from '../../components/DiffView/types';
import { askAgentPrompt } from './askAgentPrompt';

type Params = {
  readonly sessionId: SessionId;
  readonly preferKind?: AgentKind;
};

export const useAskAgent = ({ sessionId, preferKind }: Params) => {
  const phaseRuns = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const selectedAgentId = useAppStore((s) => s.selectedAgentId[sessionId] ?? null);
  const setAgentDraft = useAppStore((s) => s.setAgentDraft);
  const openDrawer = useAppStore((s) => s.openDrawer);
  const { showToast } = useToast();

  return useCallback(
    (target: DiffLineTarget) => {
      const preferred =
        preferKind === undefined
          ? undefined
          : phaseRuns.find((agent) => classifyAgent({ agent, override: null }) === preferKind);
      const agent =
        preferred ??
        phaseRuns.find((candidate) => candidate.id === selectedAgentId) ??
        phaseRuns[0];
      if (agent == null) {
        showToast({
          kind: 'warning',
          message: 'No agent in this session to ask. Start one first.',
        });
        return;
      }
      const prompt = askAgentPrompt(target);
      const existing = useAppStore.getState().agentDraft[agent.id] ?? '';
      setAgentDraft(agent.id, existing === '' ? prompt : `${existing}\n${prompt}`);
      openDrawer({ kind: 'transcript', sessionId, payload: { agentId: agent.id } });
    },
    [phaseRuns, preferKind, openDrawer, selectedAgentId, sessionId, setAgentDraft, showToast],
  );
};

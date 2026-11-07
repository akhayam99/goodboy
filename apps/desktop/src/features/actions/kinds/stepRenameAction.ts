import { Pencil } from 'lucide-react';
import type { ActionDefinition } from '../types';
import type { WorkflowRunFacts } from './workflowRun';
import { agentObjectKey } from '../agentObjectKey';
import { agentPlace } from '../../../store/slices/navigation/place';
import { dispatchAfterNavigation } from '../dispatchAfterNavigation';
import { RENAME_REQUEST_EVENT, requestRename } from '../../../shared/utils/renameRequest';

export const STEP_RENAME_ACTION: ActionDefinition<WorkflowRunFacts> = {
  id: 'workflowRun.stepRename',
  label: 'Rename',
  icon: Pencil,
  group: 'act',
  when: ({ facts }) => facts.stepAgentId !== null,
  run: ({ facts, env }) => {
    if (facts.stepAgentId === null) {
      return;
    }
    const objectKey = agentObjectKey({ agentId: facts.stepAgentId });
    const anchorKey = `agent-header:${facts.stepAgentId}`;
    if (requestRename({ objectKey, anchorKey })) {
      return;
    }
    env
      .getState()
      .navigate({ to: agentPlace({ sessionId: facts.sessionId, agentId: facts.stepAgentId }) });
    dispatchAfterNavigation({ name: RENAME_REQUEST_EVENT, detail: { objectKey, anchorKey } });
  },
};

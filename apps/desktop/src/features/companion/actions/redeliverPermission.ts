import { permissionRowOf } from '../../../store/slices/permissions/permissionRowOf';
import { oncePatternText } from '@goodboy/core/permissions';
import type { AppStore } from '../../../store/store';
import { askBatchAfterAnswer } from '../../../store/slices/permissions/askBatchAfterAnswer';
import { denialNoticeOf } from '../../../store/slices/permissions/denialNoticeOf';
import { heldOnceAllowsOf } from '../../../store/slices/permissions/heldOnceAllowsOf';
import { NO_RESOLVED_ASKS } from '../../../store/slices/permissions/noResolvedAsks';
import { withHeldAnswers } from '../../../store/slices/permissions/withHeldAnswers';
import { throwIfRefused } from '../../../store/slices/turn/refusal/throwIfRefused';
import type { UndeliveredPermission } from './undeliveredPermissions';

type Params = {
  readonly store: AppStore;
  readonly pending: UndeliveredPermission;
};

const ALLOW_PROMPT =
  'Permission for that exact command is granted for this one call. Continue where you stopped.';

export const redeliverPermission = async ({ store, pending }: Params): Promise<void> => {
  const { sessionId, agentId, toolUseId, toolName, input, verdict } = pending;
  if (store.agentTurnState[agentId]?.kind === 'running') {
    return;
  }
  const { isWaiting, held } = askBatchAfterAnswer({
    transcripts: store.transcripts,
    agentId,
    toolUseId,
  });
  if (isWaiting) {
    return;
  }
  const heldAllows = heldOnceAllowsOf({ held });
  throwIfRefused({
    result: await store.sendTurn({
      sessionId,
      agentId,
      content: withHeldAnswers({
        held,
        prompt: verdict !== 'deny' ? ALLOW_PROMPT : denialNoticeOf({ toolName, reason: '' }),
      }),
      resolvedAsks: NO_RESOLVED_ASKS,
      ...permissionRowOf({ held }),
      ...(verdict !== 'deny'
        ? { permissionOnceAllows: [...heldAllows, oncePatternText({ toolName, input })] }
        : held.length > 0 && { permissionOnceAllows: heldAllows }),
    }),
  });
};

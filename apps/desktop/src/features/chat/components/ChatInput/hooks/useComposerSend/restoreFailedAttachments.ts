import type { Dispatch, SetStateAction } from 'react';
import type { AgentId } from '@goodboy/types';
import { useAppStore } from '../../../../../../store';
import type { PendingAttachment } from '../../../../../attachments/pendingAttachment';
import { mergeFailedDraftAttachments } from './mergeFailedDraftAttachments';
import { mergeFailedPendingAttachments } from './mergeFailedPendingAttachments';

type Params = {
  readonly agentId: AgentId;
  readonly sent: ReadonlyArray<PendingAttachment>;
  readonly setAttachments: Dispatch<SetStateAction<ReadonlyArray<PendingAttachment>>>;
};

export const restoreFailedAttachments = ({ agentId, sent, setAttachments }: Params): void => {
  const stored = useAppStore.getState().agentAttachments[agentId] ?? [];
  useAppStore
    .getState()
    .setAgentAttachments(agentId, mergeFailedDraftAttachments({ sent, current: stored }));
  setAttachments((current) => mergeFailedPendingAttachments({ sent, current }));
};

import { decideIntegrationDraft, listPendingSlackDrafts } from '@goodboy/db';
import type { IntegrationDraft, WorkspaceId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';

type ListParams = {
  readonly workspaceId: WorkspaceId;
  readonly channelId: string;
  readonly threadTs: string;
};

export const loadPendingSlackDrafts = ({
  workspaceId,
  channelId,
  threadTs,
}: ListParams): Promise<ReadonlyArray<IntegrationDraft>> =>
  listPendingSlackDrafts({ db: tauriDatabase, workspaceId, channelId, threadTs });

type DecideParams = {
  readonly id: string;
  readonly status: 'sent' | 'discarded';
  readonly body?: string;
};

export const decideSlackDraft = ({ id, status, body }: DecideParams): Promise<boolean> =>
  decideIntegrationDraft({
    db: tauriDatabase,
    id,
    status,
    ...(body === undefined ? {} : { body }),
  });

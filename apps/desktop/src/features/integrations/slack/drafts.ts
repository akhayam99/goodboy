import {
  decideIntegrationDraft,
  listPendingSlackDrafts,
  listPendingSlackDraftsForSession,
} from '@goodboy/db';
import type { IntegrationDraft, SessionId, WorkspaceId } from '@goodboy/types';
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

export const loadPendingSlackDraftsForSession = (
  sessionId: SessionId,
): Promise<ReadonlyArray<IntegrationDraft>> =>
  listPendingSlackDraftsForSession({ db: tauriDatabase, sessionId });

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

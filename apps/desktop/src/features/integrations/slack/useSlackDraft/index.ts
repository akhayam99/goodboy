import { useCallback, useEffect, useState } from 'react';
import type { IntegrationDraft, WorkspaceId } from '@goodboy/types';
import { decideSlackDraft, loadPendingSlackDrafts } from '../drafts';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly channelId: string;
  readonly threadTs: string;
};

type Result = {
  readonly draft: IntegrationDraft | null;
  readonly markSent: (body: string) => Promise<void>;
  readonly discard: () => void;
};

export const useSlackDraft = ({ workspaceId, channelId, threadTs }: Params): Result => {
  const [draft, setDraft] = useState<IntegrationDraft | null>(null);

  useEffect(() => {
    let isCurrent = true;
    void loadPendingSlackDrafts({ workspaceId, channelId, threadTs })
      .then((drafts) => {
        if (isCurrent) {
          setDraft(drafts[0] ?? null);
        }
      })
      .catch(() => undefined);
    return () => {
      isCurrent = false;
    };
  }, [workspaceId, channelId, threadTs]);

  const markSent = useCallback(
    async (body: string): Promise<void> => {
      if (draft === null) {
        return;
      }
      await decideSlackDraft({ id: draft.id, status: 'sent', body });
      setDraft(null);
    },
    [draft],
  );

  const discard = useCallback((): void => {
    if (draft === null) {
      return;
    }
    void decideSlackDraft({ id: draft.id, status: 'discarded' }).then(() => setDraft(null));
  }, [draft]);

  return { draft, markSent, discard };
};

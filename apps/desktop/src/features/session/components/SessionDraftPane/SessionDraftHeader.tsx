import { Button } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectSessionDraft } from '../../../../store/slices/sessionDraft/selectSessionDraft';
import { hasSessionDraftContent } from '../../../../store/slices/sessionDraft/hasSessionDraftContent';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const SessionDraftHeader = ({ workspaceId }: Props) => {
  const hasContent = useAppStore((state) =>
    hasSessionDraftContent({ draft: selectSessionDraft({ state, workspaceId }) }),
  );
  const discardSessionDraft = useAppStore((state) => state.discardSessionDraft);

  return (
    <div className="flex min-w-0 items-center gap-2">
      <h1 className="min-w-0 flex-1 truncate text-title text-faint-foreground">New session</h1>
      {hasContent ? (
        <Button variant="ghost" size="sm" onClick={() => discardSessionDraft({ workspaceId })}>
          Discard draft
        </Button>
      ) : null}
    </div>
  );
};

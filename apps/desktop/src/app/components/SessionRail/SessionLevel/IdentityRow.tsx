import { useState } from 'react';
import { InlineMarkdown, Input, Tooltip } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useSessionSummary } from '../../../../features/workspace/hooks/useSessionSummary';
import { sessionNodeOf } from '../../../../features/workspace/components/SessionActivityBar/sessionNode';
import { SessionStateNode } from '../../../../features/workspace/components/SessionActivityBar/SessionStateNode';
import { useSessionTitleRename } from '../../../../features/session/hooks/useSessionTitleRename';
import { sessionTitle } from '../../../../features/session/sessionTitle';
import { SessionHeaderMenu } from '../../../../features/session/components/SessionOverviewPane/SessionHeaderMenu';
import { DeleteSessionConfirm } from '../../../../features/session/components/DeleteSessionConfirm';
import { useRenameRequest } from '../../../../features/actions/useRenameRequest';
import {
  SESSION_HEADER_ANCHOR,
  sessionObjectKey,
} from '../../../../features/actions/kinds/session';

type Props = {
  readonly session: Session;
};

export const IdentityRow = ({ session }: Props) => {
  const sessionId = session.id;
  const isArchived = session.archivedAt != null;
  const summary = useSessionSummary({ session });
  const node = sessionNodeOf({ info: summary.info, isArchived });
  const rename = useSessionTitleRename({ sessionId, currentTitle: session.goal });
  useRenameRequest({
    objectKey: sessionObjectKey({ sessionId }),
    anchorKeys: [null, SESSION_HEADER_ANCHOR],
    onRename: rename.start,
  });
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const title = sessionTitle({ session });
  const isNamedByGoodboy = useAppStore(
    (s) => s.goodboyNamedSessionId === sessionId && !session.titleUserEdited,
  );

  if (rename.editing) {
    return (
      <div data-level-identity="" className="flex flex-col gap-1 px-2 py-1">
        <Input
          autoFocus
          value={rename.draft}
          maxLength={rename.maxLength}
          onChange={(event) => rename.setDraft(event.target.value)}
          onBlur={() => void rename.commit()}
          onKeyDown={rename.onKeyDown}
          aria-label="Session title"
        />
        {rename.error === null ? null : (
          <span className="truncate text-meta text-danger">{rename.error}</span>
        )}
      </div>
    );
  }

  return (
    <div data-level-identity="" className="flex h-8 min-w-0 items-center gap-2 pl-2 pr-1">
      <SessionStateNode node={node} />
      <Tooltip content={isNamedByGoodboy ? 'Named by Goodboy. Click to rename' : 'Click to rename'}>
        <button
          type="button"
          onClick={rename.start}
          className="min-w-0 flex-1 cursor-text truncate rounded-md text-left text-row text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <InlineMarkdown text={title} />
        </button>
      </Tooltip>
      <DeleteSessionConfirm
        session={session}
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        trigger={() => (
          <SessionHeaderMenu
            session={session}
            onRename={rename.start}
            onDelete={() => setIsDeleteOpen(true)}
          />
        )}
      />
    </div>
  );
};

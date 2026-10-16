import { useState } from 'react';
import { Input } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useSessionTitleRename } from '../../../../features/session/hooks/useSessionTitleRename';
import { SessionHeaderMenu } from '../../../../features/session/components/SessionOverviewPane/SessionHeaderMenu';
import { DeleteSessionConfirm } from '../../../../features/session/components/DeleteSessionConfirm';
import { requestRename } from '../../../../features/actions/renameRequest';
import {
  SESSION_HEADER_ANCHOR,
  sessionObjectKey,
} from '../../../../features/actions/kinds/session';

type Props = {
  readonly session: Session;
};

export const SessionLevelMenu = ({ session }: Props) => {
  const sessionId = session.id;
  const rename = useSessionTitleRename({ sessionId, currentTitle: session.goal });
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const startRename = () => {
    const isTakenBySidebar = requestRename({
      objectKey: sessionObjectKey({ sessionId }),
      anchorKey: SESSION_HEADER_ANCHOR,
    });
    if (isTakenBySidebar) {
      return;
    }
    rename.start();
  };

  if (rename.editing) {
    return (
      <div data-session-menu="" className="flex min-w-0 flex-1 flex-col gap-1">
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
    <div data-session-menu="" className="flex shrink-0 items-center">
      <DeleteSessionConfirm
        session={session}
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        trigger={() => (
          <SessionHeaderMenu
            session={session}
            onRename={startRename}
            onDelete={() => setIsDeleteOpen(true)}
          />
        )}
      />
    </div>
  );
};

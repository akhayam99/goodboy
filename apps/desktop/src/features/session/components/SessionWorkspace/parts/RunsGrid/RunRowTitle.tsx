import type { ReactNode } from 'react';
import { TEXT_ROLE, TruncatedText, UNREAD_TITLE, cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import type { SessionRun } from '../../../../sessionRunsOf';
import { RunRowTitleInput } from './RunRowTitleInput';
import { runRowAnchorKey } from './runRowAnchorKey';
import { useRunRowRename } from './useRunRowRename';

type Props = {
  readonly sessionId: SessionId;
  readonly run: SessionRun;
  readonly rowKey: string;
  readonly suffix: ReactNode;
  readonly onOpen: () => void;
};

export const RunRowTitle = ({ sessionId, run, rowKey, suffix, onOpen }: Props) => {
  const rename = useRunRowRename({
    sessionId,
    run,
    anchorKey: runRowAnchorKey({ rowKey }),
  });
  if (rename.editing) {
    return <RunRowTitleInput rename={rename} />;
  }
  return (
    <>
      <span
        data-run-row-title=""
        className="flex min-w-0 shrink cursor-pointer select-none"
        onClick={onOpen}
      >
        <TruncatedText
          className={cn(
            'min-w-0',
            run.isUnread && UNREAD_TITLE,
            run.isFinished && !run.isUnread && TEXT_ROLE.secondary,
          )}
        >
          {run.title}
        </TruncatedText>
      </span>
      {suffix}
    </>
  );
};

import type { ReactNode } from 'react';
import { TruncatedText, UNREAD_TITLE, cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import type { SessionRun } from '../../../../sessionRunsOf';
import { RunRowTitleInput } from './RunRowTitleInput';
import { runRowAnchorKey } from './runRowAnchorKey';
import { useRunRowRename } from './useRunRowRename';
import { useTitleClick } from './useTitleClick';

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
  const click = useTitleClick({ onOpen, onRename: rename.start });
  if (rename.editing) {
    return <RunRowTitleInput rename={rename} />;
  }
  return (
    <>
      <span
        data-run-row-title=""
        className="flex min-w-0 shrink cursor-pointer select-none"
        onClick={click.onClick}
        onDoubleClick={click.onDoubleClick}
      >
        <TruncatedText className={cn('min-w-0', run.isUnread && UNREAD_TITLE)}>
          {run.title}
        </TruncatedText>
      </span>
      {suffix}
    </>
  );
};

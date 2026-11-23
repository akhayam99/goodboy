import { useState } from 'react';
import { ArrowUpRight, Trash2 } from '@goodboy/ui/icons';
import { ICON_SIZE, IconButton, Skeleton, Tooltip, cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { sessionPlace, useAppStore } from '../../../../store';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { NAMES } from '../../../../shared/utils/names';
import { formatBytes } from '../../../../shared/utils/formatBytes';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import { openSessionTerminal } from '../../../terminal/openSessionTerminal';
import type { WorktreeTrack, WorktreeVerdict } from '../../../track/tracksOfWorkspace';
import { folderWhyLine } from '../../storageCopy';
import { worktreeStateLabel } from '../../worktreeStateLabel';
import { FolderNode } from '../StoragePage/FolderNode';
import type { RemoveIntent } from '../StoragePage/folderRemoveCopyOf';
import { RowRemoveConfirm } from './RowRemoveConfirm';

type Props = {
  readonly track: WorktreeTrack;
  readonly hostSessionId: SessionId;
  readonly now: number;
  readonly isMeasuring: boolean;
  readonly onLeave: () => void;
};

const TerminalIcon = CONCEPT_ICONS.terminal;

type IntentParams = {
  readonly verdict: WorktreeVerdict;
};

const removeIntentOf = ({ verdict }: IntentParams): RemoveIntent | null => {
  if (verdict === 'safe') {
    return 'safe';
  }
  if (verdict === 'dirty' || verdict === 'unavailable') {
    return 'force';
  }
  return verdict === 'not-tracked' ? 'untracked' : null;
};

const STATE_TONE = {
  safe: 'text-muted-foreground',
  checking: 'text-faint-foreground',
  'terminal-open': 'text-foreground',
  dirty: 'text-foreground',
  writing: 'text-foreground',
  operation: 'text-foreground',
  'not-tracked': 'text-foreground',
  unavailable: 'text-foreground',
} as const satisfies Record<WorktreeVerdict, string>;

export const ProjectWorktreeRow = ({ track, hostSessionId, now, isMeasuring, onLeave }: Props) => {
  const navigate = useAppStore((state) => state.navigate);
  const isRemoving = useAppStore((state) => state.storageRemovingPaths[track.folder.path] === true);
  const [intent, setIntent] = useState<RemoveIntent | null>(null);
  const { folder, verdict, lastChangeAt } = track;
  const title =
    folder.branch === '' ? (folder.path.split('/').at(-1) ?? folder.path) : folder.branch;
  const stateLabel = isRemoving ? 'Removing…' : worktreeStateLabel({ track });
  const removeIntent = isRemoving ? null : removeIntentOf({ verdict });
  const sessionId = folder.sessionId;
  const canOpenSession =
    sessionId !== null && folder.why !== 'deleted-session' && folder.why !== 'no-session';
  const age = formatAge({ from: lastChangeAt, now });
  const whyLine = folderWhyLine({ folder });
  const rowClass = cn(
    'group/row relative flex h-10 min-w-0 items-center gap-3 rounded-sm px-2 hover:bg-hover',
    isRemoving && 'opacity-60',
  );
  if (intent !== null) {
    return (
      <div data-worktree-row={folder.path} data-verdict={verdict} className={rowClass}>
        <FolderNode status={verdict} label={stateLabel} />
        <RowRemoveConfirm folder={folder} intent={intent} onClose={() => setIntent(null)} />
      </div>
    );
  }
  return (
    <div data-worktree-row={folder.path} data-verdict={verdict} className={rowClass}>
      <FolderNode status={verdict} label={stateLabel} />
      <Tooltip content={folder.path}>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-code text-foreground">{title}</span>
          <span className="truncate text-meta text-faint-foreground">
            {age === '' ? whyLine : `${whyLine} · ${age}`}
          </span>
        </span>
      </Tooltip>
      <span className="flex w-14 shrink-0 justify-end text-meta tabular-nums text-foreground">
        {folder.sizeBytes === null ? (
          <span
            role={isMeasuring ? 'status' : undefined}
            aria-label={isMeasuring ? `Measuring ${title}` : undefined}
            className="flex justify-end"
          >
            <Skeleton className="h-3 w-10" />
          </span>
        ) : (
          formatBytes({ bytes: folder.sizeBytes })
        )}
      </span>
      <span className={cn('w-28 shrink-0 truncate text-meta', STATE_TONE[verdict])}>
        {verdict === 'checking' ? <Skeleton className="h-3 w-16" /> : stateLabel}
      </span>
      {canOpenSession ? (
        <IconButton
          size="xs"
          variant="ghost"
          icon={ArrowUpRight}
          iconSize={ICON_SIZE.row}
          label={`${NAMES.openSession}: ${folder.sessionGoal ?? title}`}
          tooltip={NAMES.openSession}
          onClick={() => {
            onLeave();
            navigate({ to: sessionPlace({ sessionId }) });
          }}
        />
      ) : null}
      <IconButton
        size="xs"
        variant="ghost"
        icon={TerminalIcon}
        iconSize={ICON_SIZE.row}
        label={`${NAMES.openInTerminal}: ${title}`}
        tooltip={NAMES.openInTerminal}
        onClick={() => {
          onLeave();
          openSessionTerminal({
            state: useAppStore.getState(),
            sessionId: hostSessionId,
            cwd: folder.path,
          });
        }}
      />
      <IconButton
        size="xs"
        variant="ghost"
        icon={Trash2}
        iconSize={ICON_SIZE.row}
        label={`${NAMES.removeWorktree}: ${title}`}
        tooltip={removeIntent === null ? stateLabel : NAMES.removeWorktree}
        disabled={removeIntent === null}
        onClick={() => setIntent(removeIntent)}
      />
    </div>
  );
};

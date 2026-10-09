import { ROW_INTERACTIVE, cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import {
  PULL_REQUEST_PRESENTATION,
  type PullRequestPresentationState,
} from '../../../../shared/pullRequestPresentation';
import { pullRequestKindOf } from '../../../../shared/pullRequestKind';
import { splitBranchLabel } from '../../../../shared/utils/branchLabel';
import { switchBranchMount } from '../../../branch/switchBranchMount';
import { lensIconClass } from '../../../session/lens-labels';
import { openLens } from '../../../session/openLens';
import { useBranchRows } from '../../hooks/useBranchRows';
import type { BranchRowModel } from './branchRowModels';

type Props = {
  readonly sessionId: SessionId;
};

const ROW_CLASS =
  'flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-label text-muted-foreground hover:text-foreground';

const requestStateOf = (row: BranchRowModel): PullRequestPresentationState =>
  row.request === null
    ? 'none'
    : pullRequestKindOf({ state: row.request.state, isDraft: row.request.isDraft });

const rowLabelOf = (row: BranchRowModel): string =>
  row.request === null
    ? row.label
    : `${row.label}, ${PULL_REQUEST_PRESENTATION[requestStateOf(row)].label}`;

export const BranchRows = ({ sessionId }: Props) => {
  const { shown, hasMore } = useBranchRows({ sessionId });
  if (shown.length === 0) {
    return null;
  }
  return (
    <ul aria-label="Branches" className="flex flex-col" data-testid="session-branches">
      {shown.map((row) => {
        const presentation = PULL_REQUEST_PRESENTATION[requestStateOf(row)];
        const Glyph = presentation.icon;
        const { head, tail } = splitBranchLabel({ branch: row.label });
        return (
          <li key={row.mountId}>
            <button
              type="button"
              aria-label={rowLabelOf(row)}
              aria-current={row.isCurrent ? 'true' : undefined}
              data-branch-row={row.mountId}
              title={row.label}
              onClick={() =>
                void switchBranchMount({
                  sessionId,
                  mountId: row.mountId,
                  worktreePath: row.worktreePath,
                  mode: 'push',
                })
              }
              className={cn(ROW_CLASS, ROW_INTERACTIVE, row.isCurrent && 'text-foreground')}
            >
              <CONCEPT_ICONS.branch
                size={ICON_SIZE.row}
                aria-hidden
                className={cn('box-content shrink-0 p-px', lensIconClass({ lens: 'branch' }))}
              />
              <span className="flex min-w-0 flex-1 items-center text-code">
                <span className="truncate">{head}</span>
                {tail === '' ? null : <span className="shrink-0">{tail}</span>}
              </span>
              {row.request === null ? null : (
                <Glyph
                  size={ICON_SIZE.row}
                  aria-hidden
                  className={cn('shrink-0', presentation.textClass)}
                />
              )}
            </button>
          </li>
        );
      })}
      {hasMore ? (
        <li>
          <button
            type="button"
            data-slot="all-branches"
            onClick={() => openLens({ sessionId, lens: null })}
            className={cn(ROW_CLASS, ROW_INTERACTIVE)}
          >
            <span className="min-w-0 flex-1 truncate pl-6">All branches</span>
          </button>
        </li>
      ) : null}
    </ul>
  );
};

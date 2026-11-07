import { READ_FAILED } from '../../../../store/slices/notifications/errorRecovery';
import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { Button, ConfirmPopover, ICON_SIZE, Listbox } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';

import { useAppStore } from '../../../../store';
import { BRANCH_PICKER_MAX_WIDTH, branchPickerOption } from '../../../worktree/branchPicker';
import { listBranchNames } from '../../../worktree/worktree';

export type RebaseRequest = {
  readonly ontoBranch: string | null;
};

type Props = {
  readonly sessionId: SessionId;
  readonly repoPath: string;
  readonly ownBranch: string;
  readonly baseBranch: string;
  readonly behind: number;
  readonly isInteractive: boolean;
  readonly onRebase: (params: RebaseRequest) => void;
};

export const HistoryRebaseHead = ({
  sessionId,
  repoPath,
  ownBranch,
  baseBranch,
  behind,
  isInteractive,
  onRebase,
}: Props) => {
  const reportError = useAppStore((state) => state.reportError);
  const [chosen, setChosen] = useState<string | null>(null);
  const [branches, setBranches] = useState<ReadonlyArray<string>>([]);
  const target = chosen ?? baseBranch;
  const isOtherBase = target !== baseBranch;

  useEffect(() => {
    let isCurrent = true;
    void listBranchNames({ repoPath })
      .then((found) => {
        if (isCurrent) {
          setBranches(found.filter((name) => name !== ownBranch));
        }
      })
      .catch((error: unknown) => {
        void reportError({
          recovery: READ_FAILED,
          title: "Couldn't list the branches",
          error,
          severity: 'warning',
          sessionId,
        });
      });
    return () => {
      isCurrent = false;
    };
  }, [ownBranch, repoPath, reportError, sessionId]);

  const options = [...new Set([baseBranch, ...branches])].map((name) =>
    branchPickerOption({ name }),
  );
  const isRebaseShown = behind > 0 || isOtherBase;
  return (
    <span className="flex shrink-0 items-center gap-1">
      {isRebaseShown ? (
        <ConfirmPopover
          role="primary"
          icon={<ArrowUp size={ICON_SIZE.row} aria-hidden />}
          title={`Rebase onto ${target}?`}
          description="Your commits replay on top of it."
          note={<p className="text-muted-foreground">A version of the current history is kept.</p>}
          confirmLabel="Rebase"
          onConfirm={() => onRebase({ ontoBranch: isOtherBase ? target : null })}
          trigger={({ arm }) => (
            <Button
              size="sm"
              variant="secondary"
              data-base-rebase
              disabled={!isInteractive}
              onClick={arm}
            >
              <ArrowUp size={ICON_SIZE.row} aria-hidden />
              {`Rebase on ${target}`}
            </Button>
          )}
        />
      ) : null}
      {options.length >= 2 ? (
        <Listbox
          ariaLabel="Rebase on another branch"
          size="sm"
          noun="branch"
          disabled={!isInteractive}
          maxPopupWidth={BRANCH_PICKER_MAX_WIDTH}
          searchable
          searchLabel="Search branches"
          searchPlaceholder="Search branches"
          value={target}
          options={options}
          onChange={(next) => setChosen(next === baseBranch ? null : next)}
          valueLabel={<span className="sr-only">Another branch</span>}
        />
      ) : null}
    </span>
  );
};

import { useEffect, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { Button, ConfirmPopover, Listbox } from '@goodboy/ui';
import type { HistoryGraph, SessionId } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useAppStore } from '../../../../store';
import { HISTORY_FOCUS_BASE_EVENT, diffEventName } from '../../../actions/kinds/diff';
import { BRANCH_PICKER_MAX_WIDTH, branchPickerOption } from '../../../worktree/branchPicker';
import { listBranchNames } from '../../../worktree/worktree';

export type RebaseRequest = {
  readonly ontoBranch: string | null;
};

type Props = {
  readonly sessionId: SessionId;
  readonly graph: HistoryGraph | null;
  readonly baseBranch: string;
  readonly baseSha: string;
  readonly forkAge: string;
  readonly repoPath: string;
  readonly ownBranch: string;
  readonly isInteractive: boolean;
  readonly isDone: boolean;
  readonly onRebase: (params: RebaseRequest) => void;
};

export const HistoryBaseRow = ({
  sessionId,
  graph,
  baseBranch,
  baseSha,
  forkAge,
  repoPath,
  ownBranch,
  isInteractive,
  isDone,
  onRebase,
}: Props) => {
  const reportError = useAppStore((state) => state.reportError);
  const behind = graph?.behind ?? 0;
  const [chosen, setChosen] = useState<string | null>(null);
  const [branches, setBranches] = useState<ReadonlyArray<string>>([]);
  const headingRef = useRef<HTMLSpanElement | null>(null);
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

  useEffect(() => {
    const name = diffEventName({ name: HISTORY_FOCUS_BASE_EVENT, sessionId });
    const onFocus = () => {
      const heading = headingRef.current;
      if (heading === null) {
        return;
      }
      heading.scrollIntoView({ block: 'center' });
      heading.parentElement?.querySelector<HTMLElement>('[data-base-rebase]')?.focus();
    };
    window.addEventListener(name, onFocus);
    return () => window.removeEventListener(name, onFocus);
  }, [sessionId]);

  const options = [...new Set([baseBranch, ...branches])].map((name) =>
    branchPickerOption({ name }),
  );
  const canRebase = isInteractive && !isDone && (behind > 0 || isOtherBase);
  const headingText = isDone
    ? 'Your branch starts here'
    : behind > 0
      ? `${behind} new ${behind === 1 ? 'commit' : 'commits'} on ${baseBranch}`
      : "Your branch starts on today's main";
  const summary =
    graph === null
      ? `${baseBranch} · merge base`
      : `${baseBranch} at ${graph.mergeBase.subject}, ${forkAge}`;
  const rebaseLabel = isOtherBase ? `Rebase onto ${target}` : 'Rebase onto latest';

  return (
    <>
      <span ref={headingRef} className="shrink-0 text-foreground">
        {headingText}
      </span>
      {options.length >= 2 && !isDone ? (
        <Listbox
          ariaLabel="Rebase onto branch"
          size="sm"
          noun="branch"
          maxPopupWidth={BRANCH_PICKER_MAX_WIDTH}
          searchable
          searchLabel="Search branches"
          searchPlaceholder="Search branches"
          value={target}
          options={options}
          onChange={(next) => setChosen(next === baseBranch ? null : next)}
          valueLabel={<span className="truncate text-code">{`${ownBranch} → ${target}`}</span>}
        />
      ) : null}
      <span className="shrink-0 text-code tabular-nums">{baseSha.slice(0, 7)}</span>
      <span className="min-w-0 flex-1 truncate">{summary}</span>
      {canRebase ? (
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
              className="shrink-0"
              data-base-rebase
              onClick={arm}
            >
              <ArrowUp size={ICON_SIZE.row} aria-hidden />
              {rebaseLabel}
            </Button>
          )}
        />
      ) : null}
    </>
  );
};

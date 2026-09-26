import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, SquareTerminal } from 'lucide-react';
import {
  Button,
  Eyebrow,
  ErrorStrip,
  InlineConfirm,
  Input,
  Notice,
  LensEmptyState,
  OverflowMenu,
  Skeleton,
  type OverflowMenuItem,
} from '@goodboy/ui';
import type { BranchCommit, HistoryStep, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useWorktreeStatuses } from '../../../session/hooks/useWorktreeStatuses';
import { selectMountForPath } from '../../../../store/slices/project-mounts/selectors';
import { scribeKeyOf } from '../../../../store/slices/scribe/scribeKeyOf';
import { PaneShell } from '../../../../shared/components/PaneShell';
import { CONCEPT_ICONS, CONCEPT_TONE, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import {
  SQUASH_LINE,
  foldInto,
  hasChanges,
  isContiguous,
  moveStep,
  planSummary,
  resetStep,
  rewordStep,
  setVerb,
  squashSteps,
  summaryLine,
  type HistoryEdit,
} from '../../historyPlan';
import { REWRITE_HISTORY_TITLE } from '../../rewriteHistoryTitle';
import { HistoryAfterApply } from './HistoryAfterApply';
import { HistoryBackups } from './HistoryBackups';
import { HistoryCommitRow } from './HistoryCommitRow';
import { HistoryDock } from './HistoryDock';
import { RewordEditor } from './RewordEditor';
import { VerbMenu } from './VerbMenu';

type Props = {
  readonly sessionId: SessionId;
  readonly worktreePath: string;
};

const EMPTY_ITEMS: ReadonlyArray<HistoryStep> = [];
const EMPTY_COMMITS: ReadonlyArray<BranchCommit> = [];

export const RewriteHistoryPage = ({ sessionId, worktreePath }: Props) => {
  const mount = useAppStore(
    (s) => selectMountForPath({ state: s, sessionId, path: worktreePath }) ?? null,
  );
  const mountId = mount?.mountId ?? null;
  const draft = useAppStore((s) => (mountId === null ? null : (s.historyDrafts[mountId] ?? null)));
  const run = useAppStore((s) => (mountId === null ? null : (s.historyRuns[mountId] ?? null)));
  const scribe = useAppStore((s) =>
    mountId === null
      ? null
      : (s.scribeWork[scribeKeyOf({ mountId, kind: 'commit-message' })] ?? null),
  );
  const loadHistoryDraft = useAppStore((s) => s.loadHistoryDraft);
  const editHistoryDraft = useAppStore((s) => s.editHistoryDraft);
  const discardHistoryDraft = useAppStore((s) => s.discardHistoryDraft);
  const applyHistoryDraft = useAppStore((s) => s.applyHistoryDraft);
  const applyRewrittenHistory = useAppStore((s) => s.applyRewrittenHistory);
  const rewriteDraftWithAgent = useAppStore((s) => s.rewriteDraftWithAgent);
  const requestScribe = useAppStore((s) => s.requestScribe);
  const openMountTerminal = useAppStore((s) => s.openMountTerminal);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [editingSha, setEditingSha] = useState<string | null>(null);
  const [squashMessage, setSquashMessage] = useState('');
  const [undoStack, setUndoStack] = useState<ReadonlyArray<ReadonlyArray<HistoryStep>>>([]);
  const [scribeFor, setScribeFor] = useState<string | null>(null);
  const [isShowingBackups, setIsShowingBackups] = useState(false);
  const [isConfirmingPush, setIsConfirmingPush] = useState(false);
  const [hasPushedBefore, setHasPushedBefore] = useState(false);
  const pushHistoryRewrite = useAppStore((s) => s.pushHistoryRewrite);
  const restoreHistory = useAppStore((s) => s.restoreHistory);
  const bringOriginIntoHistory = useAppStore((s) => s.bringOriginIntoHistory);
  const hasPushedHistoryBefore = useAppStore((s) => s.hasPushedHistoryBefore);
  const prNumber = useAppStore((s) =>
    mountId === null ? null : (s.mountGithub[mountId]?.pr?.number ?? null),
  );
  const branchName = mount?.branch ?? null;

  useEffect(() => {
    if (mountId === null || branchName === null) {
      return;
    }
    let isCurrent = true;
    void hasPushedHistoryBefore({ mountId, branch: branchName }).then((found) => {
      if (isCurrent) {
        setHasPushedBefore(found);
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [branchName, hasPushedHistoryBefore, mountId, run?.phase]);

  useEffect(() => {
    if (mountId === null) {
      return;
    }
    void loadHistoryDraft({ sessionId, mountId });
  }, [loadHistoryDraft, mountId, sessionId]);

  const items = draft?.items ?? EMPTY_ITEMS;
  const commits = draft?.commits ?? EMPTY_COMMITS;
  const commitBySha = useMemo(
    () => new Map(commits.map((commit) => [commit.sha, commit])),
    [commits],
  );
  const original = useMemo(() => [...commits].reverse().map((commit) => commit.sha), [commits]);
  const summary = planSummary({ items, original });
  const predictionBySha = useMemo(
    () => new Map((draft?.prediction?.steps ?? []).map((step) => [step.sha, step])),
    [draft?.prediction],
  );
  const newestFirst = [...items].reverse();
  const onlyHere = newestFirst.filter((step) => commitBySha.get(step.sha)?.pushed !== true);
  const onOrigin = newestFirst.filter((step) => commitBySha.get(step.sha)?.pushed === true);
  const firstChanged = items.findIndex(
    (step, index) => step.verb !== 'pick' || original[index] !== step.sha,
  );
  const touchedOrigin =
    firstChanged < 0
      ? 0
      : items.filter(
          (step, index) => index >= firstChanged && commitBySha.get(step.sha)?.pushed === true,
        ).length;
  const statusTargets = useMemo(
    () => [{ worktreePath, baseBranch: mount?.baseBranch ?? undefined }],
    [mount?.baseBranch, worktreePath],
  );
  const status = useWorktreeStatuses({ targets: statusTargets }).get(worktreePath) ?? null;
  const hasUpstream = status !== null ? status.upstream !== null : onOrigin.length > 0;
  const selectedShas = [...selected];
  const canSquash = isContiguous({ items, shas: selectedShas });
  const scribeSuggestion =
    scribe?.status === 'ready' && scribeFor !== null && scribeFor === editingSha
      ? (scribe.output?.commitMessages[0]?.message ?? null)
      : null;

  if (mountId === null || mount === null) {
    return (
      <PaneShell title={REWRITE_HISTORY_TITLE} icon={CONCEPT_ICONS.history}>
        <LensEmptyState
          tone={CONCEPT_TONE.history}
          icon={CONCEPT_ICONS.history}
          title="This branch is not in the session"
          description="Pick a branch from the trail to rewrite its history."
        />
      </PaneShell>
    );
  }

  const apply = ({
    next,
    edit,
  }: {
    readonly next: ReadonlyArray<HistoryStep>;
    readonly edit: HistoryEdit | null;
  }) => {
    if (next === items) {
      return;
    }
    setUndoStack((stack) => [...stack.slice(-19), items]);
    void editHistoryDraft({ sessionId, mountId, items: next, edit });
  };
  const undo = () => {
    const previous = undoStack[undoStack.length - 1];
    if (previous === undefined) {
      return;
    }
    setUndoStack((stack) => stack.slice(0, -1));
    void editHistoryDraft({ sessionId, mountId, items: previous, edit: null });
  };
  const olderThan = ({ sha }: { readonly sha: string }): ReadonlyArray<BranchCommit> => {
    const index = items.findIndex((step) => step.sha === sha);
    return items
      .slice(0, Math.max(index, 0))
      .filter((step) => step.verb !== 'drop' && step.verb !== 'fixup')
      .reverse()
      .flatMap((step) => {
        const commit = commitBySha.get(step.sha);
        return commit === undefined ? [] : [commit];
      });
  };
  const move = ({
    sha,
    direction,
  }: {
    readonly sha: string;
    readonly direction: 'newer' | 'older';
  }) => {
    const moved = moveStep({ items, sha, direction });
    if (moved.other === null) {
      return;
    }
    apply({
      next: moved.items,
      edit:
        direction === 'newer'
          ? { kind: 'move', sha, other: moved.other }
          : { kind: 'move', sha: moved.other, other: sha },
    });
  };
  const squashWithBelow = ({ sha }: { readonly sha: string }) => {
    const older = olderThan({ sha })[0];
    if (older === undefined) {
      return;
    }
    apply({
      next: squashSteps({ items, shas: [older.sha, sha], message: '' }),
      edit: { kind: 'squash', shas: [older.sha, sha] },
    });
  };
  const onKey = ({
    sha,
    key,
    withAlt,
  }: {
    readonly sha: string;
    readonly key: string;
    readonly withAlt: boolean;
  }): boolean => {
    if (withAlt && key === 'ArrowUp') {
      move({ sha, direction: 'newer' });
      return true;
    }
    if (withAlt && key === 'ArrowDown') {
      move({ sha, direction: 'older' });
      return true;
    }
    const lower = key.toLowerCase();
    if (lower === 'p') {
      apply({ next: resetStep({ items, sha }), edit: { kind: 'verb', sha, verb: 'pick' } });
      return true;
    }
    if (lower === 'd') {
      apply({
        next: setVerb({ items, sha, verb: 'drop' }),
        edit: { kind: 'verb', sha, verb: 'drop' },
      });
      return true;
    }
    if (lower === 'r') {
      setEditingSha(sha);
      return true;
    }
    if (lower === 's') {
      squashWithBelow({ sha });
      return true;
    }
    if (lower === 'f') {
      const target = olderThan({ sha })[0];
      if (target !== undefined) {
        apply({
          next: foldInto({ items, sha, target: target.sha }),
          edit: { kind: 'fold', sha, target: target.sha },
        });
      }
      return true;
    }
    return false;
  };
  const toggle = ({ sha }: { readonly sha: string }) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(sha)) {
        next.delete(sha);
        return next;
      }
      next.add(sha);
      return next;
    });
  };
  const suggest = ({ commit }: { readonly commit: BranchCommit }) => {
    setScribeFor(commit.sha);
    void requestScribe({
      sessionId,
      mountId,
      task: {
        kind: 'commit-message',
        verb: 'reword',
        commits: [{ sha: commit.sha, subject: commit.subject }],
      },
    }).catch(() => undefined);
  };

  const renderRow = (step: HistoryStep) => {
    const commit = commitBySha.get(step.sha);
    if (commit === undefined) {
      return null;
    }
    const isBusy =
      run !== null &&
      run.phase !== 'stopped' &&
      run.phase !== 'pushed' &&
      run.phase !== 'applied' &&
      run.phase !== 'rewritten';
    return (
      <HistoryCommitRow
        key={step.sha}
        commit={commit}
        step={step}
        prediction={predictionBySha.get(step.sha) ?? null}
        isSelected={selected.has(step.sha)}
        isEditing={editingSha === step.sha}
        onToggleSelect={() => toggle({ sha: step.sha })}
        onStartReword={() => setEditingSha(step.sha)}
        onKey={(key, withAlt) => onKey({ sha: step.sha, key, withAlt })}
        editor={
          <RewordEditor
            initialMessage={step.message ?? commit.subject}
            suggestion={scribeSuggestion}
            isSuggesting={scribe?.status === 'writing' && scribeFor === step.sha}
            onSuggest={() => suggest({ commit })}
            onSave={(message) => {
              setEditingSha(null);
              apply({
                next: rewordStep({ items, sha: step.sha, message }),
                edit: { kind: 'reword', sha: step.sha },
              });
            }}
            onCancel={() => setEditingSha(null)}
          />
        }
        verbControl={
          <VerbMenu
            step={step}
            older={olderThan({ sha: step.sha })}
            isOnOrigin={commit.pushed}
            disabled={isBusy}
            onPick={() =>
              apply({
                next: resetStep({ items, sha: step.sha }),
                edit: { kind: 'verb', sha: step.sha, verb: 'pick' },
              })
            }
            onReword={() => setEditingSha(step.sha)}
            onSquash={() => squashWithBelow({ sha: step.sha })}
            onFold={(target) =>
              apply({
                next: foldInto({ items, sha: step.sha, target }),
                edit: { kind: 'fold', sha: step.sha, target },
              })
            }
            onDrop={() =>
              apply({
                next: setVerb({ items, sha: step.sha, verb: 'drop' }),
                edit: { kind: 'verb', sha: step.sha, verb: 'drop' },
              })
            }
            onMove={(direction) => move({ sha: step.sha, direction })}
          />
        }
      />
    );
  };

  const overflow: OverflowMenuItem[] = [
    {
      kind: 'item',
      key: 'backups',
      label: 'Backups',
      icon: CONCEPT_ICONS.backup,
      onClick: () => setIsShowingBackups(true),
    },
    {
      kind: 'item',
      key: 'terminal',
      label: 'Open terminal here',
      icon: SquareTerminal,
      onClick: () => openMountTerminal(sessionId, worktreePath),
    },
  ];
  const meta = (
    <span className="flex flex-wrap items-center gap-1.5">
      <span>{mount.mountName}</span>
      <span aria-hidden>·</span>
      <span>
        {commits.length} {commits.length === 1 ? 'commit' : 'commits'} since{' '}
        {mount.baseBranch ?? 'main'}
      </span>
      {onOrigin.length > 0 ? (
        <>
          <span aria-hidden>·</span>
          <span>{onOrigin.length} on origin</span>
        </>
      ) : null}
    </span>
  );
  const actions = (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => void loadHistoryDraft({ sessionId, mountId })}
      >
        <RefreshCw size={ICON_SIZE.row} aria-hidden />
        Refresh
      </Button>
      <OverflowMenu items={overflow} label="More history actions" align="right" />
    </>
  );

  const body =
    draft === null ? (
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-8 w-full rounded-md" />
        ))}
      </div>
    ) : draft.loadError !== null && commits.length === 0 ? (
      <ErrorStrip
        label="this branch's commits"
        error={new Error(draft.loadError)}
        onRetry={() => void loadHistoryDraft({ sessionId, mountId })}
      />
    ) : commits.length === 0 ? (
      <LensEmptyState
        tone={CONCEPT_TONE.history}
        icon={CONCEPT_ICONS.history}
        title={`Nothing to rewrite on ${mount.branch}`}
        description="This branch has no commits of its own yet."
      />
    ) : (
      <div className="flex flex-col gap-4">
        {isShowingBackups ? (
          <HistoryBackups
            worktreePath={worktreePath}
            branch={mount.branch}
            hasUpstream={hasUpstream}
            revision={run?.updatedAt ?? 0}
            onRestore={(backup) =>
              void restoreHistory({
                sessionId,
                mountId,
                backupRef: backup.refName,
                shouldPush: hasUpstream,
              })
            }
            onClose={() => setIsShowingBackups(false)}
          />
        ) : null}
        {selectedShas.length >= 2 ? (
          <div className="flex min-w-0 flex-col gap-1.5 rounded-md border border-border-soft bg-subtle p-2.5">
            <span className="text-label text-foreground">
              {canSquash
                ? SQUASH_LINE
                : 'Squash needs neighbouring commits. Move them together first.'}
            </span>
            <div className="flex min-w-0 items-center gap-2">
              <Input
                value={squashMessage}
                onChange={(event) => setSquashMessage(event.target.value)}
                placeholder="Message for the combined commit, optional"
                aria-label="Squash message"
                className="h-7 min-w-0 flex-1 text-label"
                disabled={!canSquash}
              />
              <Button
                size="sm"
                variant="primary"
                disabled={!canSquash}
                onClick={() => {
                  apply({
                    next: squashSteps({ items, shas: selectedShas, message: squashMessage }),
                    edit: { kind: 'squash', shas: selectedShas },
                  });
                  setSelected(new Set());
                  setSquashMessage('');
                }}
              >
                Squash {selectedShas.length}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
            </div>
          </div>
        ) : null}
        {onlyHere.length > 0 ? (
          <section className="flex flex-col gap-1">
            <Eyebrow label={`Only here · ${onlyHere.length}`} muted />
            <ul className="flex flex-col">{onlyHere.map(renderRow)}</ul>
          </section>
        ) : null}
        {onOrigin.length > 0 ? (
          <section className="flex flex-col gap-1">
            <Eyebrow label={`On origin · ${onOrigin.length}`} muted />
            <ul className="flex flex-col">{onOrigin.map(renderRow)}</ul>
          </section>
        ) : null}
        <div className="flex min-w-0 items-center gap-2 px-2 text-secondary text-faint-foreground">
          <span className="font-mono tabular-nums">{draft.baseSha.slice(0, 7)}</span>
          <span className="truncate">
            {mount.baseBranch ?? 'main'} · merge base · not editable here
          </span>
        </div>
      </div>
    );

  return (
    <PaneShell
      title={REWRITE_HISTORY_TITLE}
      icon={CONCEPT_ICONS.history}
      tone={CONCEPT_TONE.history}
      meta={meta}
      actions={actions}
      scroll="body"
      dock={
        draft !== null && commits.length > 0 ? (
          <div className="flex flex-col gap-3">
            {run !== null ? (
              <HistoryAfterApply
                run={run}
                hasUpstream={hasUpstream}
                prNumber={prNumber}
                onPushWithLease={() =>
                  void pushHistoryRewrite({
                    sessionId,
                    mountId,
                    origin: run.origin,
                    planId: run.planId,
                    expectedRemoteSha: run.remoteSha,
                  })
                }
                onUndo={() => {
                  if (run.backupRef !== null) {
                    void restoreHistory({
                      sessionId,
                      mountId,
                      backupRef: run.backupRef,
                      shouldPush: false,
                    });
                  }
                }}
                onShowBackups={() => setIsShowingBackups(true)}
              />
            ) : null}
            {touchedOrigin > 0 && prNumber !== null ? (
              <Notice
                tone="info"
                placement="inline"
                title={`Rewrites ${touchedOrigin} ${touchedOrigin === 1 ? 'commit' : 'commits'} on origin`}
                body={`PR #${prNumber} updates, and review comments on changed lines may show as outdated.`}
              />
            ) : null}
            {isConfirmingPush ? (
              <InlineConfirm
                role="danger"
                icon={<CONCEPT_ICONS.history size={ICON_SIZE.row} aria-hidden />}
                title="Push with lease rewrites origin."
                description="Your backup stays here."
                confirmLabel="Apply and push"
                onConfirm={() => {
                  setIsConfirmingPush(false);
                  void applyHistoryDraft({ sessionId, mountId, shouldPush: true });
                }}
                onCancel={() => setIsConfirmingPush(false)}
              />
            ) : null}
            <HistoryDock
              summary={summaryLine({ summary })}
              hasChanges={hasChanges({ summary })}
              prediction={draft.prediction}
              isPredicting={draft.isPredicting}
              conflictEdit={draft.conflictEdit}
              run={run}
              hasUpstream={hasUpstream}
              originCount={touchedOrigin}
              onApply={(shouldPush) => {
                if (shouldPush && touchedOrigin > 0 && !hasPushedBefore) {
                  setIsConfirmingPush(true);
                  return;
                }
                void applyHistoryDraft({ sessionId, mountId, shouldPush });
              }}
              onDiscard={() => {
                setUndoStack([]);
                void discardHistoryDraft({ sessionId, mountId });
              }}
              onRewriteWithAgent={() => void rewriteDraftWithAgent({ sessionId, mountId })}
              onUndoEdit={undoStack.length > 0 ? undo : null}
              onBringOrigin={() => void bringOriginIntoHistory({ sessionId, mountId })}
              onApplyRewritten={(shouldPush) =>
                void applyRewrittenHistory({ sessionId, mountId, shouldPush })
              }
            />
          </div>
        ) : null
      }
    >
      {body}
    </PaneShell>
  );
};

import { useMemo, type ReactNode } from 'react';
import { Undo2 } from 'lucide-react';
import { Button, ConfirmPopover, ICON_SIZE, Notice, Tooltip, type NoticeTone } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { openInConfiguredEditor } from '../../../shared/lib/editorSettings';
import { NAMES } from '../../../shared/utils/names';
import { START_HINT_SCOPES } from '../../../store/slices/startHints/startHintScopes';
import { StartHint } from '../../../shared/components/StartHint';
import { START_HINT_COPY } from '../../../shared/components/startHintCopy';
import { autoUnavailableReason } from '../../auto/autoUnavailableReason';
import type { ActionConfirm, DiffActionTarget } from '../../actions/types';
import { useActionControls } from '../../actions/useActionControls';
import type { useJobBannerActions } from '../hooks/useJobBannerActions';
import type { RebaseJobState, RebaseJobTone } from '../rebaseJob';
import type { RebaseJobControls } from '../useRebaseJob';
import { JobBannerDetails } from '../JobBanner/JobBannerDetails';
import { JobBannerReview } from '../JobBanner/JobBannerReview';
import { RebaseConflictPrompt } from './RebaseConflictPrompt';
import { REBASE_ABORT_CONFIRM } from './rebaseAbortConfirm';
import { RebaseOriginCommits } from './RebaseOriginCommits';
import { RebaseStopFiles, type OpenFileParams } from './RebaseStopFiles';

type Props = {
  readonly sessionId: SessionId;
  readonly worktreePath: string;
  readonly controls: RebaseJobControls;
  readonly actions: ReturnType<typeof useJobBannerActions>;
};

const TONE_OF: Readonly<Record<RebaseJobTone, NoticeTone>> = {
  info: 'info',
  ok: 'success',
  warn: 'warning',
  danger: 'danger',
};

const PUSH_ID = 'diff.push';

type VerbConfirm = {
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly role: ActionConfirm['role'];
  readonly notes: ReadonlyArray<string>;
  readonly isOpen?: boolean;
  readonly onConfirm: () => void;
  readonly onCancel?: () => void;
};

type ContinueParams = {
  readonly left: number | null;
};

const continueBlockedOf = ({ left }: ContinueParams): string | null => {
  if (left === null) {
    return 'Reading the files that still conflict.';
  }
  if (left === 0) {
    return null;
  }
  return `Resolve ${left} ${left === 1 ? 'file' : 'files'} first.`;
};

type Verb = {
  readonly key: string;
  readonly label: string;
  readonly variant: 'primary' | 'secondary' | 'ghost';
  readonly run: () => void;
  readonly blockedReason?: string | null;
  readonly confirm?: VerbConfirm | null;
};

type WhenParams = {
  readonly isOn: boolean;
  readonly verbs: ReadonlyArray<Verb>;
};

const verbsWhen = ({ isOn, verbs }: WhenParams): ReadonlyArray<Verb> => (isOn ? verbs : []);

type VerbParams = {
  readonly verb: Verb;
};

const DISMISSABLE: ReadonlySet<RebaseJobState> = new Set<RebaseJobState>([
  'result-differs',
  'failed',
]);

const FILES_LABEL: Partial<Record<RebaseJobState, string>> = {
  'rebasing-here': 'Files to resolve',
  'auto-resolving': 'Files Auto resolves',
};

export const RebaseStopPanel = ({ sessionId, worktreePath, controls, actions }: Props) => {
  const { job, stop, agentId, status, files, originCommits } = controls;
  const mountId = stop.run.mountId;
  const autoBlocked = useAppStore((state) => autoUnavailableReason({ state }));
  const target = useMemo<DiffActionTarget>(
    () => ({
      kind: 'diff',
      sessionId,
      worktreePath,
      status,
      remoteKind: null,
      patch: '',
      rebaseConflicts: 0,
    }),
    [sessionId, status, worktreePath],
  );
  const registry = useActionControls({ target });
  const pushAction = registry.actions.find((action) => action.id === PUSH_ID);
  const isBusy = actions.pendingKeys.size > 0 || registry.pendingId !== null;
  const openFile = ({ path }: OpenFileParams): void => {
    void openInConfiguredEditor({
      path: `${worktreePath}/${path}`,
      state: useAppStore.getState(),
    });
  };
  const state = job.state;
  const left = files?.left ?? null;

  const verbs = ((): ReadonlyArray<Verb> => {
    switch (state) {
      case 'conflict':
        return [
          {
            key: 'resolve-auto',
            label: 'Resolve with Auto',
            variant: 'primary',
            run: actions.resolveWithAuto,
            blockedReason: autoBlocked,
          },
          {
            key: 'resolve-myself',
            label: 'Resolve myself',
            variant: 'secondary',
            run: actions.resolveMyself,
          },
          { key: 'keep', label: 'Keep branch as it was', variant: 'ghost', run: actions.keep },
        ];
      case 'rebasing-here':
        return [
          {
            key: 'continue',
            label: 'Continue rebase',
            variant: 'primary',
            run: actions.continueRebase,
            blockedReason: continueBlockedOf({ left }),
          },
          {
            key: 'open-terminal',
            label: 'Open terminal',
            variant: 'secondary',
            run: controls.openTerminal,
          },
          {
            key: 'abort-here',
            label: 'Abort rebase',
            variant: 'ghost',
            run: actions.abortHere,
            confirm: { ...REBASE_ABORT_CONFIRM, notes: [], onConfirm: actions.abortHere },
          },
        ];
      case 'auto-resolving':
        return agentId === null
          ? []
          : [
              {
                key: 'open-auto',
                label: 'Open Auto',
                variant: 'secondary',
                run: controls.seeWhatItDid,
              },
            ];
      case 'auto-done':
      case 'rebased-here':
        return [
          ...verbsWhen({
            isOn: pushAction !== undefined,
            verbs: [
              {
                key: 'push',
                label: 'Push',
                variant: 'primary',
                run: () => registry.trigger({ actionId: PUSH_ID }),
                blockedReason: pushAction?.blockedReason ?? null,
                confirm:
                  pushAction?.confirm === null || pushAction?.confirm === undefined
                    ? null
                    : {
                        title: pushAction.confirm.title,
                        description: pushAction.confirm.description,
                        confirmLabel: pushAction.confirm.confirmLabel,
                        role: pushAction.confirm.role,
                        notes: pushAction.confirm.notes ?? [],
                        isOpen: registry.confirming?.id === PUSH_ID,
                        onConfirm: () => void registry.confirm(),
                        onCancel: registry.cancel,
                      },
              },
            ],
          }),
          ...verbsWhen({
            isOn: state === 'auto-done' && agentId !== null,
            verbs: [
              {
                key: 'see-auto',
                label: 'See what Auto did',
                variant: 'ghost',
                run: controls.seeWhatItDid,
              },
            ],
          }),
        ];
      case 'pushed':
        return [{ key: 'dismiss', label: 'Dismiss', variant: 'ghost', run: controls.dismiss }];
      case 'origin-moved':
        return [
          { key: 'bring-in', label: 'Bring them in', variant: 'primary', run: actions.bringIn },
          {
            key: 'open-terminal',
            label: 'Resolve myself',
            variant: 'secondary',
            run: controls.openTerminal,
          },
          ...verbsWhen({
            isOn: controls.canUndo,
            verbs: [
              {
                key: 'undo-rebase',
                label: 'Undo rebase',
                variant: 'ghost',
                run: actions.undoRebase,
              },
            ],
          }),
        ];
      case 'push-failed':
        return [
          { key: 'fix-push', label: 'Fix with agent', variant: 'primary', run: actions.fixPush },
          {
            key: 'push-terminal',
            label: 'Open terminal here',
            variant: 'secondary',
            run: controls.openPushTerminal,
          },
          ...verbsWhen({
            isOn: !stop.isRebuilt,
            verbs: [
              {
                key: 'retry-push',
                label: NAMES.retryPush,
                variant: 'ghost',
                run: actions.retryPush,
              },
            ],
          }),
        ];
      case 'dirty':
      case 'head-moved':
      case 'blocked':
      case 'result-differs':
      case 'failed':
        return [
          {
            key: 'retry-rebase',
            label: 'Retry rebase',
            variant: 'primary',
            run: actions.retryRebase,
          },
          {
            key: 'open-terminal',
            label: 'Open terminal',
            variant: 'secondary',
            run: controls.openTerminal,
          },
          ...verbsWhen({
            isOn: DISMISSABLE.has(state),
            verbs: [{ key: 'keep', label: 'Dismiss', variant: 'ghost', run: actions.keep }],
          }),
        ];
      case 'choosing':
      case 'restore-conflict':
      case 'set-aside':
      case 'checking':
      case 'replaying':
      case 'merging':
      case 'checking-result':
      case 'waiting':
      case 'moving':
      case 'updating-online':
      case 'done':
      case 'stuck':
      case 'no-provider':
      case 'fixing-push':
        return [];
      default: {
        const exhaustive: never = state;
        return exhaustive;
      }
    }
  })();

  const buttonOf = ({ verb }: VerbParams): ReactNode => {
    const isPending =
      actions.pendingKeys.has(verb.key) || (verb.key === 'push' && registry.pendingId === PUSH_ID);
    const blockedReason = verb.blockedReason ?? null;
    const confirm = verb.confirm ?? null;
    if (confirm !== null) {
      const isControlled = confirm.isOpen !== undefined;
      return (
        <ConfirmPopover
          key={verb.key}
          role={confirm.role}
          icon={<Undo2 size={ICON_SIZE.row} aria-hidden />}
          title={confirm.title}
          description={confirm.description}
          confirmLabel={confirm.confirmLabel}
          onConfirm={confirm.onConfirm}
          isOpen={confirm.isOpen}
          onCancel={confirm.onCancel}
          note={
            confirm.notes.length === 0 ? undefined : (
              <div className="flex min-w-0 flex-col gap-1 text-muted-foreground">
                {confirm.notes.map((note) => (
                  <p key={note}>{note}</p>
                ))}
              </div>
            )
          }
          trigger={({ arm }) => (
            <Button
              size="sm"
              variant={verb.variant}
              data-rebase-verb={verb.key}
              disabled={isBusy || blockedReason !== null}
              isBusy={isPending}
              onClick={isControlled ? verb.run : arm}
            >
              {verb.label}
            </Button>
          )}
        />
      );
    }
    const button = (
      <Button
        key={verb.key}
        size="sm"
        variant={verb.variant}
        data-rebase-verb={verb.key}
        disabled={isBusy || blockedReason !== null}
        isBusy={isPending}
        onClick={verb.run}
      >
        {verb.label}
      </Button>
    );
    if (blockedReason === null) {
      return button;
    }
    return (
      <Tooltip key={verb.key} content={blockedReason}>
        <span className="inline-flex">{button}</span>
      </Tooltip>
    );
  };

  const failure = actions.failure ?? null;
  const conflictFiles = files?.files ?? [];

  const body = (() => {
    switch (state) {
      case 'conflict':
        return (
          <RebaseConflictPrompt
            sessionId={sessionId}
            mountId={mountId}
            files={conflictFiles}
            isHintDisabled={isBusy}
            onOpenFile={openFile}
          />
        );
      case 'rebasing-here':
      case 'auto-resolving':
        return (
          <RebaseStopFiles
            label={FILES_LABEL[state] ?? 'Files'}
            files={conflictFiles}
            onOpen={state === 'rebasing-here' ? openFile : null}
          />
        );
      case 'origin-moved':
        return <RebaseOriginCommits commits={originCommits ?? []} />;
      case 'push-failed':
        return (
          <StartHint
            sessionId={sessionId}
            scope={START_HINT_SCOPES.pushFix({ mountId })}
            label={START_HINT_COPY.implementerLabel}
            placeholder={START_HINT_COPY.pushFix}
          />
        );
      case 'auto-done':
      case 'rebased-here':
      case 'pushed':
      case 'dirty':
      case 'head-moved':
      case 'blocked':
      case 'result-differs':
      case 'failed':
      case 'choosing':
      case 'restore-conflict':
      case 'set-aside':
      case 'checking':
      case 'replaying':
      case 'merging':
      case 'checking-result':
      case 'waiting':
      case 'moving':
      case 'updating-online':
      case 'done':
      case 'stuck':
      case 'no-provider':
      case 'fixing-push':
        return null;
      default: {
        const exhaustive: never = state;
        return exhaustive;
      }
    }
  })();

  return (
    <section
      aria-label="Rebase"
      data-rebase-stop={state}
      data-state={state}
      className="flex min-w-0 flex-col"
    >
      <Notice
        role={job.isRunning ? 'status' : 'alert'}
        tone={TONE_OF[job.tone]}
        placement="banner"
        title={job.title}
        body={job.line}
      >
        <div className="flex min-w-0 flex-col gap-3">
          {body}
          <JobBannerReview sessionId={sessionId} mountId={mountId} />
          {failure === null && registry.failure === null ? null : (
            <div role="alert" className="flex min-w-0 items-center gap-2 text-meta text-danger">
              <span className="min-w-0 flex-1 break-words">
                {actions.failureLine ?? registry.failure?.message}
              </span>
              <Button
                size="xs"
                variant="ghost"
                onClick={failure === null ? registry.retry : actions.retryFailed}
              >
                Retry
              </Button>
            </div>
          )}
          {verbs.length === 0 && job.detail === null ? null : (
            <div className="flex flex-wrap items-center gap-2">
              {verbs.map((verb) => buttonOf({ verb }))}
              {job.detail === null ? null : <JobBannerDetails detail={job.detail} />}
            </div>
          )}
        </div>
      </Notice>
    </section>
  );
};

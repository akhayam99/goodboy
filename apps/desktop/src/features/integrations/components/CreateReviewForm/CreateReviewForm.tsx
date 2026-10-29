import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ArrowUpToLine } from 'lucide-react';
import { Button, ICON_SIZE, InlineConfirm, Tooltip, formatError } from '@goodboy/ui';
import type { MountId, SessionExternalTask, SessionId } from '@goodboy/types';
import { useResolution } from '../../../providers/hooks/useResolution';
import { taskModelAgentSpawnConfig } from '../../../session/taskModelAgentSpawnConfig';
import type { AgentSpawnConfigValue } from '../../../session/agentSpawnConfigValue';
import { useWorktreeStatuses } from '../../../session/hooks/useWorktreeStatuses';
import {
  closingIssueReferences,
  type ClosingIssueReference,
} from '../../github/closingIssueReferences';
import type { LocalBranchInfo } from '../../../worktree/worktree';
import { useToast } from '../../../../shared/components/Toast';
import { branchPushFactsOf } from '../../../../shared/lib/branchPushState';
import { distanceAhead } from '../../../../shared/lib/gitStatus';
import { useAppStore } from '../../../../store';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';
import { forcePushConfirm } from '../../../actions/kinds/gitRuns';
import {
  loadOnlyOnline,
  readOnlyOnline,
  type OnlineCommit,
} from '../../../../store/runtime/worktreeStatuses/onlyOnline';
import { SCRIBE_WRITING_REASON } from '../../../../store/slices/scribe/scribeWritingReason';
import { useSessionRepo } from '../../../../store/slices/worktrees/useSessionRepo';
import type { PushFixFollowUp } from '../../../../store/slices/history/types';
import { CreateNotices } from './CreateNotices';
import { openedSentenceOf } from './openedSentenceOf';
import { requestReviewersOrWarn } from './requestReviewersOrWarn';
import { ReviewSettings } from './ReviewSettings';
import { ReviewTextCard } from './ReviewTextCard';
import { ScribeBar } from './ScribeBar';
import { useCreateReviewBases } from './useCreateReviewBases';
import { useScribeJob } from './useScribeJob';
import type {
  CreatedReview,
  ForcePushInput,
  CreateReviewInput,
  CreateReviewNouns,
  RequestReviewersParams,
  ReviewBases,
  SearchReviewers,
} from './types';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId?: MountId | null;
  readonly defaultTitle: string;
  readonly defaultBody?: string;
  readonly closedPr?: { readonly number: number; readonly url: string };
  readonly nouns: CreateReviewNouns;
  readonly canSetDraft: boolean;
  readonly loadBases: (() => Promise<ReviewBases>) | null;
  readonly searchReviewers: SearchReviewers | null;
  readonly hasPushStep: boolean;
  readonly hasCloses: boolean;
  readonly create: (input: CreateReviewInput) => Promise<CreatedReview>;
  readonly requestReviewers: (params: RequestReviewersParams) => Promise<void>;
  readonly onCreated: (created: CreatedReview) => void;
  readonly submitVariant?: 'primary' | 'secondary';
  readonly trailing?: ReactNode;
};

type Phase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'creating'; readonly isPushed: boolean }
  | { readonly kind: 'failed'; readonly error: unknown };

type CreateParams = {
  readonly forcePush: ForcePushInput | null;
};

type TextSnapshot = {
  readonly title: string;
  readonly body: string;
  readonly scribeBody: string | null;
};

const IDLE: Phase = { kind: 'idle' };

const NO_TASKS: ReadonlyArray<SessionExternalTask> = [];

export const CreateReviewForm = ({
  sessionId,
  mountId = null,
  defaultTitle,
  defaultBody = '',
  closedPr,
  nouns,
  canSetDraft,
  loadBases,
  searchReviewers,
  hasPushStep,
  hasCloses,
  create,
  requestReviewers,
  onCreated,
  submitVariant = 'primary',
  trailing = null,
}: Props) => {
  const { showToast } = useToast();
  const repo = useSessionRepo({ sessionId, mountId });
  const branch = repo?.branch ?? null;
  const scribeMountId = mountId ?? repo?.mountId ?? null;
  const job = useScribeJob({ mountId: scribeMountId });
  const requestScribe = useAppStore((state) => state.requestScribe);
  const stopScribe = useAppStore((state) => state.stopScribe);
  const connectedProviders = useAppStore(
    useShallow((state) =>
      state.providers.filter((provider) => provider.connection === 'connected').map(({ id }) => id),
    ),
  );
  const resolution = useResolution({ task: 'pr_draft', sessionId });
  const resolvedRouting = useMemo(() => taskModelAgentSpawnConfig({ resolution }), [resolution]);
  const [routing, setRouting] = useState<AgentSpawnConfigValue>(resolvedRouting);
  const [isRoutingTouched, setIsRoutingTouched] = useState(false);
  const [title, setTitle] = useState(defaultTitle);
  const [body, setBody] = useState(defaultBody);
  const [base, setBase] = useState('');
  const [isDraft, setIsDraft] = useState(false);
  const [reviewers, setReviewers] = useState<ReadonlyArray<string>>([]);
  const [dismissed, setDismissed] = useState<ReadonlyArray<number>>([]);
  const [scribeBody, setScribeBody] = useState<string | null>(null);
  const [isWritten, setIsWritten] = useState(false);
  const [phase, setPhase] = useState<Phase>(IDLE);
  const [writeError, setWriteError] = useState<string | null>(null);
  const appliedStamp = useRef(0);
  const latest = useRef<TextSnapshot>({ title, body, scribeBody });
  latest.current = { title, body, scribeBody };
  const defaults = useRef({ title: defaultTitle, body: defaultBody });

  useEffect(() => {
    const previous = defaults.current;
    defaults.current = { title: defaultTitle, body: defaultBody };
    setTitle((current) => (current === previous.title ? defaultTitle : current));
    setBody((current) => (current === previous.body ? defaultBody : current));
  }, [defaultBody, defaultTitle]);

  useEffect(() => {
    if (!isRoutingTouched) {
      setRouting(resolvedRouting);
    }
  }, [isRoutingTouched, resolvedRouting]);

  const onDefaultBase = useCallback(
    (branchName: string) => setBase((current) => (current.trim() === '' ? branchName : current)),
    [],
  );
  const bases = useCreateReviewBases({ load: loadBases, onDefault: onDefaultBase });
  const branchOptions = useMemo<ReadonlyArray<LocalBranchInfo> | null>(
    () =>
      loadBases === null
        ? null
        : bases.branches.map((name) => ({ name, inUse: false, hasUncommitted: false })),
    [bases.branches, loadBases],
  );

  const linkedTasks = useAppStore((state) => state.sessionExternalTasks[sessionId] ?? NO_TASKS);
  const references = useMemo(
    () =>
      closingIssueReferences({ tasks: linkedTasks, branch, body }).filter(
        (reference) => !dismissed.includes(reference.number),
      ),
    [body, branch, dismissed, linkedTasks],
  );

  const statusTargets = useMemo(
    () => (repo === null ? [] : [{ worktreePath: repo.worktreePath }]),
    [repo],
  );
  const statuses = useWorktreeStatuses({ targets: statusTargets });
  const status = repo === null ? null : (statuses.get(repo.worktreePath) ?? null);
  const pushFacts = branchPushFactsOf({ status });
  const unpushed = pushFacts.toPush;
  const canForce = hasPushStep && pushFacts.canForce;
  const workspaceId = useAppStore(
    (state) => sessionById(state.sessions, sessionId)?.workspaceId ?? null,
  );
  const [onlyOnline, setOnlyOnline] = useState<ReadonlyArray<OnlineCommit> | null>(null);
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const [isConfirmingForce, setIsConfirmingForce] = useState(false);

  useEffect(() => {
    if (!canForce || repo === null) {
      setIsConfirmingForce(false);
      return;
    }
    let isCurrent = true;
    const check = async (): Promise<void> => {
      try {
        await loadOnlyOnline({
          mountId: repo.mountId,
          worktreePath: repo.worktreePath,
          branch: repo.branch,
          workspaceId,
          projectId: repo.projectId,
        });
        if (isCurrent) {
          setOnlyOnline(readOnlyOnline({ mountId: repo.mountId, branch: repo.branch }));
          setOnlineError(null);
        }
      } catch (error) {
        if (isCurrent) {
          setOnlyOnline(null);
          setOnlineError(formatError(error));
        }
      }
    };
    void check();
    return () => {
      isCurrent = false;
    };
  }, [canForce, repo, workspaceId]);
  const commitCount = status === null ? null : distanceAhead({ distance: status.mainDistance });

  const isWriting = job.status === 'writing';
  const isCreating = phase.kind === 'creating';
  const isLocked = isWriting || isCreating;
  const scribeFailure =
    job.status === 'failed' ? (job.error ?? 'Scribe wrote no text.') : (job.error ?? writeError);
  const changelogEntry = job.output?.changelogEntry ?? null;
  const hasText = title !== defaultTitle || body !== '';

  const restore = useCallback(
    ({
      title: previousTitle,
      body: previousBody,
      scribeBody: previousScribeBody,
    }: TextSnapshot) => {
      setTitle(previousTitle);
      setBody(previousBody);
      setScribeBody(previousScribeBody);
      setIsWritten(previousScribeBody !== null);
    },
    [],
  );

  useEffect(() => {
    const output = job.output;
    if (output === null || (job.status !== 'ready' && job.status !== 'failed')) {
      return;
    }
    if (appliedStamp.current === job.updatedAt) {
      return;
    }
    appliedStamp.current = job.updatedAt;
    if (output.prTitle === null && output.prBody === null) {
      return;
    }
    const nextTitle = output.prTitle;
    const nextBody = output.prBody;
    const previous = latest.current;
    if (nextTitle !== null) {
      setTitle(nextTitle);
    }
    if (nextBody !== null) {
      setBody(nextBody);
      setScribeBody(nextBody);
    }
    setIsWritten(true);
    if (previous.title !== defaultTitle || previous.body !== '') {
      showToast({
        kind: 'info',
        message: "Scribe's text replaced yours",
        action: { label: 'Undo', onClick: () => restore(previous) },
      });
    }
  }, [defaultTitle, job.output, job.status, job.updatedAt, restore, showToast]);

  const onWrite = () => {
    if (isLocked || scribeMountId === null) {
      return;
    }
    setWriteError(null);
    void requestScribe({
      sessionId,
      mountId: scribeMountId,
      task: {
        kind: 'pr',
        closedPrNumber: closedPr?.number ?? null,
        references: references.map((reference) => reference.line),
        isDraft,
        base: base.trim() === '' ? null : base.trim(),
        isTextOnly: true,
      },
      hint: routing.hint,
      routing: { provider: routing.provider, model: routing.model, effort: routing.effort },
    }).catch((error: unknown) => setWriteError(formatError(error)));
  };

  const onStop = () => {
    if (job.key !== null) {
      void stopScribe({ key: job.key });
    }
  };

  const onDiscard = () => {
    const snapshot: TextSnapshot = { title, body, scribeBody };
    appliedStamp.current = job.updatedAt;
    if (job.key !== null && job.status !== 'writing') {
      void stopScribe({ key: job.key });
    }
    setTitle(defaultTitle);
    setBody('');
    setScribeBody(null);
    setIsWritten(false);
    setPhase(IDLE);
    showToast({
      kind: 'info',
      message: 'Text discarded',
      action: { label: 'Undo', onClick: () => restore(snapshot) },
    });
  };

  const onCreate = async ({ forcePush }: CreateParams): Promise<PushFixFollowUp | undefined> => {
    if (isLocked || title.trim().length === 0) {
      return undefined;
    }
    setIsConfirmingForce(false);
    setPhase({ kind: 'creating', isPushed: false });
    try {
      const created = await create({
        title,
        body,
        base,
        isDraft: canSetDraft && isDraft,
        isScribeBody: scribeBody !== null && body === scribeBody,
        dismissed,
        forcePush,
        onPushed: () => setPhase({ kind: 'creating', isPushed: true }),
      });
      await requestReviewersOrWarn({ requestReviewers, showToast, sessionId, created, reviewers });
      setPhase(IDLE);
      onCreated(created);
      const sentence = openedSentenceOf({ nouns, created });
      return { tone: 'done' as const, sentence };
    } catch (error) {
      setPhase({ kind: 'failed', error });
      return { tone: 'failed' as const, sentence: formatError(error) };
    }
  };

  const isDraftRequested = canSetDraft && isDraft;
  const draft = { title, body, base, isDraft: isDraftRequested };

  const onReferenceRemove = (reference: ClosingIssueReference) =>
    setDismissed((current) => [...current, reference.number]);

  const draftLabel = canSetDraft && isDraft ? nouns.createDraft : nouns.create;
  const lowerDraftLabel = `${draftLabel.charAt(0).toLowerCase()}${draftLabel.slice(1)}`;
  const createLabel = canForce
    ? `Force push and ${lowerDraftLabel}`
    : hasPushStep && unpushed > 0
      ? `Push and ${lowerDraftLabel}`
      : draftLabel;
  const forceConfirm = forcePushConfirm({ onlyOnline });
  const isCreateDisabled = isLocked || title.trim().length === 0;

  return (
    <div className="grid min-w-0 grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_296px]">
      <div className="flex min-w-0 flex-col gap-4">
        <ReviewTextCard
          title={title}
          body={body}
          noun={nouns.long}
          isWriting={isWriting}
          isLocked={isLocked}
          scribeFailure={scribeFailure}
          onTitleChange={setTitle}
          onBodyChange={setBody}
          onRetry={onWrite}
        >
          <ScribeBar
            job={job}
            branch={branch ?? ''}
            commitCount={commitCount}
            isCreating={isCreating}
            hasPushStep={hasPushStep}
            isPushed={phase.kind === 'creating' && phase.isPushed}
            isWritten={isWritten}
            isDisabled={isLocked || scribeMountId === null}
            noun={nouns.long}
            routing={routing}
            connectedProviders={connectedProviders}
            onRoutingChange={(value) => {
              setIsRoutingTouched(true);
              setRouting(value);
            }}
            onWrite={onWrite}
            onStop={onStop}
          />
        </ReviewTextCard>
        <CreateNotices
          sessionId={sessionId}
          mountId={scribeMountId}
          hasPushStep={hasPushStep}
          nouns={nouns}
          failure={phase.kind === 'failed' ? { error: phase.error } : null}
          draft={draft}
          onRetry={() => onCreate({ forcePush: null })}
        />
        {!hasPushStep && unpushed > 0 && (
          <p className="text-meta text-faint-foreground">
            {`Pushes ${unpushed} local ${unpushed === 1 ? 'commit' : 'commits'} first.`}
          </p>
        )}
        <div data-slot="create-actions" className="flex items-center justify-end gap-2">
          {hasText && (
            <Button
              variant="ghost"
              size="md"
              className="text-muted-foreground"
              disabled={isLocked}
              onClick={onDiscard}
            >
              Discard text
            </Button>
          )}
          <Tooltip content={SCRIBE_WRITING_REASON} isSuppressed={!isWriting} side="top">
            <Button
              size="md"
              variant={submitVariant}
              data-create-submit={submitVariant}
              disabled={isCreateDisabled}
              onClick={() =>
                canForce ? setIsConfirmingForce(true) : void onCreate({ forcePush: null })
              }
            >
              {createLabel}
            </Button>
          </Tooltip>
        </div>
        {isConfirmingForce && canForce && (
          <InlineConfirm
            role="danger"
            icon={<ArrowUpToLine size={ICON_SIZE.control} aria-hidden />}
            title={forceConfirm.title}
            description={forceConfirm.description}
            confirmLabel={forceConfirm.confirmLabel}
            note={
              <div className="flex min-w-0 flex-col gap-1 text-muted-foreground">
                {[
                  ...(forceConfirm.notes ?? []),
                  ...(onlineError === null ? [] : [onlineError]),
                ].map((note) => (
                  <p key={note}>{note}</p>
                ))}
              </div>
            }
            onConfirm={async () => {
              await onCreate({
                forcePush: { confirmedOnlyOnline: onlyOnline?.map((commit) => commit.sha) ?? null },
              });
            }}
            onCancel={() => setIsConfirmingForce(false)}
          />
        )}
        {trailing}
      </div>
      <ReviewSettings
        sessionId={sessionId}
        base={base}
        branches={branchOptions}
        isBasesLoading={bases.isLoading}
        basesError={bases.error}
        onBasesRetry={bases.retry}
        isLocked={isLocked}
        canSetDraft={canSetDraft}
        isDraft={isDraft}
        reviewers={reviewers}
        searchReviewers={searchReviewers}
        references={hasCloses ? references : []}
        changelogEntry={changelogEntry}
        onBaseChange={setBase}
        onDraftChange={setIsDraft}
        onReviewersChange={setReviewers}
        onReferenceRemove={onReferenceRemove}
      />
    </div>
  );
};

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button, Notice, Tooltip, formatError } from '@goodboy/ui';
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
import { branchPushStateOf, commitsToPush } from '../../../../shared/lib/branchPushState';
import { distanceAhead } from '../../../../shared/lib/gitStatus';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { SCRIBE_WRITING_REASON } from '../../../../store/slices/scribe/scribeWritingReason';
import { useSessionRepo } from '../../../../store/slices/worktrees/useSessionRepo';
import { ReviewSettings } from './ReviewSettings';
import { ReviewTextCard } from './ReviewTextCard';
import { ScribeBar } from './ScribeBar';
import { useCreateReviewBases } from './useCreateReviewBases';
import { useScribeJob } from './useScribeJob';
import type {
  CreatedReview,
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
};

type Phase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'creating'; readonly isPushed: boolean }
  | { readonly kind: 'failed'; readonly message: string };

type TextSnapshot = {
  readonly title: string;
  readonly body: string;
};

const IDLE: Phase = { kind: 'idle' };

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
}: Props) => {
  const { showToast } = useToast();
  const repo = useSessionRepo({ sessionId });
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
  const latest = useRef<TextSnapshot>({ title, body });
  latest.current = { title, body };

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

  const linkedTasks = useAppStore(
    (state) =>
      state.sessionExternalTasks[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<SessionExternalTask>),
  );
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
  const unpushed = status === null ? 0 : commitsToPush({ state: branchPushStateOf({ status }) });
  const commitCount = status === null ? null : distanceAhead({ distance: status.mainDistance });

  const isWriting = job.status === 'writing';
  const isCreating = phase.kind === 'creating';
  const isLocked = isWriting || isCreating;
  const scribeFailure =
    job.status === 'failed' ? (job.error ?? 'Scribe wrote no text.') : writeError;
  const changelogEntry = job.output?.changelogEntry ?? null;
  const hasText = title !== defaultTitle || body !== '';

  const restore = useCallback(({ title: previousTitle, body: previousBody }: TextSnapshot) => {
    setTitle(previousTitle);
    setBody(previousBody);
    setScribeBody(null);
    setIsWritten(false);
  }, []);

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
    const snapshot: TextSnapshot = { title, body };
    appliedStamp.current = job.updatedAt;
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

  const onCreate = async () => {
    if (isLocked || title.trim().length === 0) {
      return;
    }
    setPhase({ kind: 'creating', isPushed: false });
    try {
      const created = await create({
        title,
        body,
        base,
        isDraft: canSetDraft && isDraft,
        isScribeBody: scribeBody !== null && body === scribeBody,
        dismissed,
        onPushed: () => setPhase({ kind: 'creating', isPushed: true }),
      });
      if (reviewers.length > 0 && created.number !== null) {
        await requestReviewers({ sessionId, number: created.number, logins: reviewers }).catch(
          (error: unknown) =>
            showToast({
              kind: 'warning',
              message: `Reviewers were not requested: ${formatError(error)}`,
            }),
        );
      }
      setPhase(IDLE);
      onCreated(created);
    } catch (error) {
      setPhase({ kind: 'failed', message: formatError(error) });
    }
  };

  const onReferenceRemove = (reference: ClosingIssueReference) =>
    setDismissed((current) => [...current, reference.number]);

  const createLabel = canSetDraft && isDraft ? nouns.createDraft : nouns.create;
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
        {phase.kind === 'failed' && (
          <Notice
            tone="danger"
            placement="inline"
            role="alert"
            title={`Couldn't open the ${nouns.long}`}
            body="The text is kept."
            detail={phase.message}
          />
        )}
        {unpushed > 0 && (
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
            <Button size="md" disabled={isCreateDisabled} onClick={() => void onCreate()}>
              {createLabel}
            </Button>
          </Tooltip>
        </div>
      </div>
      <ReviewSettings
        sessionId={sessionId}
        base={base}
        branches={branchOptions}
        isBasesLoading={bases.isLoading}
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

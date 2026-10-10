import { useEffect, useMemo, useRef, useState } from 'react';
import type { MountId, SessionExternalTask, SessionId } from '@goodboy/types';
import {
  Button,
  FieldRow,
  FormActions,
  formatError,
  FormPage,
  Input,
  SectionHeader,
  SegmentedTabs,
  Skeleton,
  Switch,
  Textarea,
} from '@goodboy/ui';
import { AlertTriangle, ArrowRight, PenLine, RotateCw } from 'lucide-react';
import { ghBaseBranches } from '../../github';
import { closingIssueReferences } from '../../closingIssueReferences';
import { AgentSpawnConfig } from '../../../../session/components/AgentSpawnConfig';
import type { AgentSpawnConfigValue } from '../../../../session/agentSpawnConfigValue';
import { taskModelAgentSpawnConfig } from '../../../../session/taskModelAgentSpawnConfig';
import { useAutoLimitContext } from '../../../../providers/hooks/useAutoLimitContext';
import { BranchCombobox } from '../../../../worktree/BranchCombobox';
import type { LocalBranchInfo } from '../../../../worktree/worktree';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { scribeKeyOf } from '../../../../../store/slices/scribe/scribeKeyOf';
import { SCRIBE_WRITING_REASON } from '../../../../../store/slices/scribe/scribeWritingReason';
import { useSessionRepo } from '../../../../../store/slices/worktrees/useSessionRepo';
import { openUrl } from '../../../../../shared/lib/editor';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { sessionById } from '../../../../../store/slices/sessions/sessionIndex';

type CreateMode = 'manual' | 'agent';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId?: MountId | null;
  readonly defaultTitle: string;
  readonly closedPr?: { number: number; url: string };
  readonly onCreated: () => void;
  readonly onCancel?: () => void;
};

export const CreatePrPanel = ({
  sessionId,
  mountId = null,
  defaultTitle,
  closedPr,
  onCreated,
  onCancel,
}: Props) => {
  const createPrForSession = useAppStore((s) => s.createPrForSession);
  const repo = useSessionRepo({ sessionId });
  const branch = repo?.branch ?? null;
  const projectRoot = repo?.repoRoot ?? null;
  const projectId = repo?.projectId;
  const session = useAppStore((s) => sessionById(s.sessions, sessionId) ?? null);
  const workspaceId = session?.workspaceId;
  const workspaceOverrides = useAppStore((s) =>
    workspaceId == null ? null : (s.workspaceOverrides?.[workspaceId] ?? null),
  );
  const limitContext = useAutoLimitContext();
  const resolvedAgentConfig = useMemo(
    () =>
      taskModelAgentSpawnConfig({
        task: 'pr_draft',
        preferences: workspaceOverrides?.taskModels,
        workspaceDefaultProviderId: workspaceOverrides?.defaultProviderId,
        sessionDefaultProviderId: session?.providerPreference?.defaultProvider ?? 'anthropic',
        limitContext,
      }),
    [limitContext, workspaceOverrides, session?.providerPreference?.defaultProvider],
  );

  const [mode, setMode] = useState<CreateMode>('manual');
  const [title, setTitle] = useState(defaultTitle);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const field = titleRef.current;
    if (field === null) {
      return;
    }
    field.setSelectionRange(0, 0);
    field.scrollLeft = 0;
  }, []);
  const [body, setBody] = useState('');
  const [base, setBase] = useState('');
  const [branches, setBranches] = useState<ReadonlyArray<string>>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [draft, setDraft] = useState(true);
  const [busy, setBusy] = useState<'create' | 'ai' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agentConfig, setAgentConfig] = useState<AgentSpawnConfigValue>(resolvedAgentConfig);
  const [agentConfigUserTouched, setAgentConfigUserTouched] = useState(false);
  const [scribeBody, setScribeBody] = useState<string | null>(null);
  const filledByScribe = useRef<{ title: string | null; body: string | null }>({
    title: null,
    body: null,
  });
  const [hasAskedScribe, setHasAskedScribe] = useState(false);
  const requestScribe = useAppStore((s) => s.requestScribe);
  const openScribePullRequest = useAppStore((s) => s.openScribePullRequest);
  const scribeMountId = mountId ?? repo?.mountId ?? null;
  const scribeKey =
    scribeMountId === null ? null : scribeKeyOf({ mountId: scribeMountId, kind: 'pr' });
  const scribeWork = useAppStore((s) =>
    scribeKey === null ? null : (s.scribeWork[scribeKey] ?? null),
  );
  const isScribeWriting = scribeWork?.status === 'writing';
  const isScribeOpening = scribeWork?.status === 'creating';
  const isScribeBusy = isScribeWriting || isScribeOpening;
  const keptOutput = scribeWork?.status === 'failed' ? scribeWork.output : null;
  const scribeFailure = scribeWork?.status === 'failed' ? scribeWork.error : null;
  const canRetry =
    keptOutput !== null && (keptOutput.prTitle !== null || keptOutput.prBody !== null);
  const changelogEntry = keptOutput?.changelogEntry ?? null;

  useEffect(() => {
    if (keptOutput === null) {
      return;
    }
    const keptTitle = keptOutput.prTitle;
    const keptBody = keptOutput.prBody;
    const previousTitle = filledByScribe.current.title;
    const previousBody = filledByScribe.current.body;
    if (keptTitle !== null) {
      setTitle((typed) => (typed === defaultTitle || typed === previousTitle ? keptTitle : typed));
      filledByScribe.current = { ...filledByScribe.current, title: keptTitle };
    }
    if (keptBody !== null) {
      setBody((typed) => (typed === '' || typed === previousBody ? keptBody : typed));
      filledByScribe.current = { ...filledByScribe.current, body: keptBody };
      setScribeBody(keptBody);
    }
    setMode('manual');
  }, [defaultTitle, keptOutput]);

  useEffect(() => {
    if (!hasAskedScribe || scribeWork?.status !== 'created') {
      return;
    }
    setHasAskedScribe(false);
    onCreated();
  }, [hasAskedScribe, onCreated, scribeWork?.status]);

  const branchOptions = useMemo<ReadonlyArray<LocalBranchInfo>>(
    () => branches.map((name) => ({ name, inUse: false, hasUncommitted: false })),
    [branches],
  );

  const linkedTasks = useAppStore(
    (s) => s.sessionExternalTasks[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<SessionExternalTask>),
  );
  const references = useMemo(
    () =>
      closingIssueReferences({
        tasks: linkedTasks,
        branch,
        body: mode === 'manual' ? body : '',
      }),
    [body, branch, linkedTasks, mode],
  );

  useEffect(() => {
    if (agentConfigUserTouched) {
      return;
    }
    setAgentConfig(resolvedAgentConfig);
  }, [agentConfigUserTouched, resolvedAgentConfig]);

  useEffect(() => {
    if (projectRoot == null) {
      setBranchesLoading(false);
      return;
    }
    let cancelled = false;
    setBranchesLoading(true);
    void ghBaseBranches(projectRoot, workspaceId, projectId).then(
      ({ defaultBranch, branches: list }) => {
        if (cancelled) {
          return;
        }
        setBranches(list);
        setBranchesLoading(false);
        if (defaultBranch != null) {
          setBase((cur) => (cur.trim() === '' ? defaultBranch : cur));
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [projectId, projectRoot, workspaceId]);

  const onCreate = async () => {
    if (busy !== null || isScribeBusy || title.trim().length === 0) {
      return;
    }
    setBusy('create');
    setError(null);
    try {
      await createPrForSession({
        sessionId,
        ...(mountId === null ? {} : { mountId }),
        title,
        body,
        base,
        draft,
        isScribeBody: scribeBody !== null && body === scribeBody,
      });
      onCreated();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(null);
    }
  };

  const onRetry = () => {
    if (scribeKey === null || busy !== null || isScribeBusy) {
      return;
    }
    setError(null);
    setHasAskedScribe(true);
    void openScribePullRequest({ key: scribeKey });
  };

  const onCreateWithAi = async () => {
    if (busy !== null || isScribeBusy || scribeMountId === null) {
      return;
    }
    setBusy('ai');
    setError(null);
    setHasAskedScribe(true);
    try {
      await requestScribe({
        sessionId,
        mountId: scribeMountId,
        task: {
          kind: 'pr',
          closedPrNumber: closedPr?.number ?? null,
          references: references.map((reference) => reference.line),
          isDraft: draft,
          base: base.trim() === '' ? null : base.trim(),
        },
        hint: agentConfig.hint,
        routing: {
          provider: agentConfig.provider,
          model: agentConfig.model,
          effort: agentConfig.effort,
        },
      });
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <FormPage>
        <section className="flex flex-col gap-6">
          <section className="flex flex-col">
            <SectionHeader
              label="How"
              hint="Fill the pull request yourself, or let Scribe write it and open it for you."
              action={
                <SegmentedTabs
                  ariaLabel="Creation mode"
                  size="sm"
                  options={[
                    {
                      value: 'manual',
                      label: 'Manual',
                      icon: PenLine,
                      disabled: isScribeBusy,
                      tooltip: isScribeBusy ? SCRIBE_WRITING_REASON : undefined,
                    },
                    {
                      value: 'agent',
                      label: 'Draft with an agent',
                      icon: CONCEPT_ICONS.agents,
                      disabled: isScribeBusy,
                      tooltip: isScribeBusy ? SCRIBE_WRITING_REASON : undefined,
                    },
                  ]}
                  value={mode}
                  onChange={setMode}
                />
              }
            />
            {mode === 'manual' ? (
              <>
                <FieldRow label="Title" help="A short summary of the change.">
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Pull request title"
                    disabled={busy !== null}
                    aria-label="Pull request title"
                    className="h-8 w-full text-body sm:w-96"
                    ref={titleRef}
                    autoFocus
                  />
                </FieldRow>
                <FieldRow label="Description" help="What changed and why. Markdown supported.">
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="What changed and why"
                    className="w-full text-body sm:w-96"
                    autoGrow
                    minRows={3}
                    maxRows={12}
                    disabled={busy !== null}
                    aria-label="Pull request description"
                  />
                </FieldRow>
                <FieldRow label="Base branch" help="The branch this pull request merges into.">
                  <div className="w-full sm:w-96">
                    {branchesLoading ? (
                      <Skeleton className="h-9 w-full rounded-md border border-border" />
                    ) : (
                      <BranchCombobox
                        branches={branchOptions}
                        value={base}
                        onChange={setBase}
                        disabled={busy !== null}
                        loading={false}
                      />
                    )}
                  </div>
                </FieldRow>
              </>
            ) : (
              <FieldRow
                label="Agent"
                layout="stacked"
                help="Routing and optional notes for Scribe. It writes the title and description, never code. Goodboy then pushes the branch and opens the pull request."
              >
                <AgentSpawnConfig
                  value={agentConfig}
                  onChange={(value) => {
                    setAgentConfigUserTouched(true);
                    setAgentConfig(value);
                  }}
                  disabled={busy !== null}
                  role={{ label: 'Scribe', hint: 'Fixed by this panel' }}
                />
              </FieldRow>
            )}
            {references.length > 0 && (
              <>
                <FieldRow
                  label="Issue links"
                  help="Added to the description so GitHub closes these issues when this merges."
                >
                  <ul className="flex flex-col gap-2">
                    {references.map((reference) => (
                      <li key={reference.number} className="flex items-center gap-2">
                        <code
                          data-testid="pr-issue-reference"
                          className="rounded-md bg-muted px-2 py-0.5 font-mono text-chip text-foreground"
                        >
                          {reference.line}
                        </code>
                        <button
                          type="button"
                          onClick={() => void openUrl(reference.url)}
                          className="truncate text-meta text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {reference.identifier}
                        </button>
                      </li>
                    ))}
                  </ul>
                </FieldRow>
              </>
            )}
            {changelogEntry !== null && (
              <>
                <FieldRow
                  label="Changelog entry"
                  help="Scribe wrote it in the format of the repository changelog. Copy it where it belongs."
                >
                  <pre className="w-full whitespace-pre-wrap rounded-md bg-muted px-2 py-1 font-mono text-chip text-foreground sm:w-96">
                    {changelogEntry}
                  </pre>
                </FieldRow>
              </>
            )}
            <FieldRow label="Open as draft" help="Reviewers are asked once you mark it ready.">
              <Switch
                ariaLabel="Open as draft"
                checked={draft}
                onChange={setDraft}
                disabled={busy !== null}
              />
            </FieldRow>
          </section>
        </section>
        <FormActions
          leading={
            <>
              {error == null && isScribeWriting && (
                <span className="inline-flex min-w-0 items-center gap-2 truncate text-label text-muted-foreground">
                  <CONCEPT_ICONS.agents size={ICON_SIZE.row} aria-hidden className="shrink-0" />
                  Scribe is writing the title and description.
                </span>
              )}
              {error == null && isScribeOpening && (
                <span className="inline-flex min-w-0 items-center gap-2 truncate text-label text-muted-foreground">
                  <CONCEPT_ICONS.agents size={ICON_SIZE.row} aria-hidden className="shrink-0" />
                  Pushing the branch and opening the pull request.
                </span>
              )}
              {error == null && scribeFailure !== null && (
                <span
                  role="alert"
                  className="inline-flex min-w-0 items-center gap-1 truncate text-label text-danger"
                  title={scribeFailure}
                >
                  <AlertTriangle size={ICON_SIZE.row} aria-hidden className="shrink-0" />
                  {scribeFailure}
                </span>
              )}
              {error != null && (
                <span
                  role="alert"
                  className="inline-flex min-w-0 items-center gap-1 truncate text-label text-danger"
                  title={error}
                >
                  <AlertTriangle size={ICON_SIZE.row} aria-hidden className="shrink-0" />
                  {error}
                </span>
              )}
            </>
          }
        >
          {onCancel != null && (
            <Button
              variant="ghost"
              size="md"
              onClick={onCancel}
              disabled={busy !== null}
              className="text-muted-foreground"
            >
              Cancel
            </Button>
          )}
          {canRetry && (
            <Button
              variant="secondary"
              size="md"
              onClick={onRetry}
              disabled={busy !== null || isScribeBusy}
            >
              <RotateCw size={ICON_SIZE.row} aria-hidden />
              Retry
            </Button>
          )}
          {mode === 'manual' ? (
            <Button
              onClick={() => void onCreate()}
              disabled={busy !== null || isScribeBusy || title.trim().length === 0}
            >
              {busy === 'create' ? (
                <span className="text-shimmer">Creating…</span>
              ) : (
                <>
                  Create pull request
                  <ArrowRight size={ICON_SIZE.row} aria-hidden />
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={() => void onCreateWithAi()}
              disabled={busy !== null || isScribeBusy || scribeMountId === null}
            >
              {busy === 'ai' || isScribeWriting ? (
                <span className="text-shimmer">Writing…</span>
              ) : isScribeOpening ? (
                <span className="text-shimmer">Opening…</span>
              ) : (
                <>
                  <CONCEPT_ICONS.agents size={ICON_SIZE.row} aria-hidden />
                  Write and open
                </>
              )}
            </Button>
          )}
        </FormActions>
      </FormPage>
    </div>
  );
};

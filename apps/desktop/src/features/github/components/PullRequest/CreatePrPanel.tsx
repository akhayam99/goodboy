import { useEffect, useMemo, useState } from 'react';
import type { MountId, SessionExternalTask, SessionId } from '@goodboy/types';
import {
  Button,
  Checkbox,
  Divider,
  FieldRow,
  Input,
  ScrollFade,
  SectionHeader,
  SegmentedTabs,
  Skeleton,
  Textarea,
} from '@goodboy/ui';
import { AlertTriangle, ArrowRight, GitBranch, PenLine } from 'lucide-react';
import { ghBaseBranches } from '../../github';
import { usePrDraftAgentRunning } from '../../usePrDraftAgentRunning';
import { closingIssueReferences } from '../../closingIssueReferences';
import { AgentSpawnConfig } from '../../../session/components/AgentSpawnConfig';
import type { AgentSpawnConfigValue } from '../../../session/components/AgentSpawnConfig/AgentSpawnConfigValue';
import { taskModelAgentSpawnConfig } from '../../../session/components/AgentSpawnConfig/taskModelAgentSpawnConfig';
import { useAutoLimitContext } from '../../../providers/hooks/useAutoLimitContext';
import { BranchCombobox } from '../../../worktree/BranchCombobox';
import type { LocalBranchInfo } from '../../../worktree/worktree';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { scribeKeyOf } from '../../../../store/slices/scribe/scribeKeyOf';
import { useSessionRepo } from '../../../../store/slices/worktrees/useSessionRepo';
import { openUrl } from '../../../../shared/lib/editor';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { PANE_RHYTHM } from '@goodboy/ui';

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
  const isDraftAgentRunning = usePrDraftAgentRunning({ sessionId });
  const repo = useSessionRepo({ sessionId });
  const branch = repo?.branch ?? null;
  const projectRoot = repo?.repoRoot ?? null;
  const projectId = repo?.projectId;
  const session = useAppStore((s) => s.sessions.find((x) => x.id === sessionId) ?? null);
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
  const requestScribe = useAppStore((s) => s.requestScribe);
  const scribeMountId = mountId ?? repo?.mountId ?? null;
  const scribeWork = useAppStore((s) =>
    scribeMountId === null
      ? null
      : (s.scribeWork[scribeKeyOf({ mountId: scribeMountId, kind: 'pr' })] ?? null),
  );
  const isScribeWriting = scribeWork?.status === 'writing';
  const scribeOutput = scribeWork?.status === 'ready' ? scribeWork.output : null;
  const scribeFailure = scribeWork?.status === 'failed' ? scribeWork.error : null;
  const changelogEntry = scribeOutput?.changelogEntry ?? null;

  useEffect(() => {
    if (scribeOutput === null) {
      return;
    }
    if (scribeOutput.prTitle !== null) {
      setTitle(scribeOutput.prTitle);
    }
    if (scribeOutput.prBody !== null) {
      setBody(scribeOutput.prBody);
      setScribeBody(scribeOutput.prBody);
    }
    setMode('manual');
  }, [scribeOutput]);

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
    if (busy !== null || isDraftAgentRunning || isScribeWriting || title.trim().length === 0) {
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
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const onCreateWithAi = async () => {
    if (busy !== null || isDraftAgentRunning || isScribeWriting || scribeMountId === null) {
      return;
    }
    setBusy('ai');
    setError(null);
    try {
      await requestScribe({
        sessionId,
        mountId: scribeMountId,
        task: {
          kind: 'pr',
          closedPrNumber: closedPr?.number ?? null,
          references: references.map((reference) => reference.line),
          isDraft: draft,
        },
        hint: agentConfig.hint,
        routing: {
          provider: agentConfig.provider,
          model: agentConfig.model,
          effort: agentConfig.effort,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScrollFade className="min-h-0 flex-1" viewportClassName={PANE_RHYTHM.body} fadeSize={24}>
        <section className="mx-auto flex w-full max-w-2xl flex-col gap-6">
          <SectionHeader
            label="Open a pull request"
            action={
              <span className="inline-flex items-center gap-1 font-mono text-secondary text-muted-foreground">
                <GitBranch size={11} aria-hidden />
                {branch ?? 'no branch'}
              </span>
            }
          />
          <section className="flex flex-col">
            <SectionHeader
              label="How"
              hint="Fill the pull request yourself, or let Scribe write the title and description for you to check."
              action={
                <SegmentedTabs
                  ariaLabel="Creation mode"
                  size="sm"
                  options={[
                    { value: 'manual', label: 'Manual', icon: PenLine },
                    { value: 'agent', label: 'Write it for me', icon: CONCEPT_ICONS.agents },
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
                    autoFocus
                  />
                </FieldRow>
                <Divider />
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
                <Divider />
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
                help="Routing and optional notes for Scribe. It writes the title and description, never code, and you open the pull request."
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
                <Divider />
                <FieldRow
                  label="Issue links"
                  help="Added to the description so GitHub closes these issues when this merges."
                >
                  <ul className="flex flex-col gap-1.5">
                    {references.map((reference) => (
                      <li key={reference.number} className="flex items-center gap-2">
                        <code
                          data-testid="pr-issue-reference"
                          className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-secondary text-foreground"
                        >
                          {reference.line}
                        </code>
                        <button
                          type="button"
                          onClick={() => void openUrl(reference.url)}
                          className="truncate text-secondary text-muted-foreground transition-colors hover:text-foreground"
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
                  <pre className="w-full whitespace-pre-wrap rounded-md bg-muted px-2 py-1.5 font-mono text-secondary text-foreground sm:w-96">
                    {changelogEntry}
                  </pre>
                </FieldRow>
              </>
            )}
            <Divider />
            <FieldRow
              label="Open as draft"
              help="Creates the pull request in GitHub's draft state."
            >
              <Checkbox checked={draft} onChange={setDraft} disabled={busy !== null} />
            </FieldRow>
          </section>
        </section>
      </ScrollFade>

      <Divider />

      <footer className="shrink-0 px-6 py-3">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {error == null && isScribeWriting && (
              <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-label text-muted-foreground">
                <CONCEPT_ICONS.agents size={ICON_SIZE.row} aria-hidden className="shrink-0" />
                Scribe is writing the title and description.
              </span>
            )}
            {error == null && scribeFailure !== null && (
              <span
                role="status"
                className="inline-flex min-w-0 items-center gap-1 truncate text-label text-warning"
              >
                <AlertTriangle size={ICON_SIZE.row} aria-hidden className="shrink-0" />
                {scribeFailure}
              </span>
            )}
            {error == null && isDraftAgentRunning && (
              <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-label text-muted-foreground">
                <CONCEPT_ICONS.agents size={ICON_SIZE.row} aria-hidden className="shrink-0" />
                An agent is already opening a pull request for this session.
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
          </div>
          {onCancel != null && (
            <Button variant="ghost" onClick={onCancel} disabled={busy !== null}>
              Cancel
            </Button>
          )}
          {mode === 'manual' ? (
            <Button
              onClick={() => void onCreate()}
              disabled={
                busy !== null || isDraftAgentRunning || isScribeWriting || title.trim().length === 0
              }
            >
              {busy === 'create' ? (
                <span className="text-shimmer">Creating…</span>
              ) : (
                <>
                  Create PR
                  <ArrowRight size={ICON_SIZE.row} aria-hidden />
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={() => void onCreateWithAi()}
              disabled={
                busy !== null || isDraftAgentRunning || isScribeWriting || scribeMountId === null
              }
            >
              {busy === 'ai' || isScribeWriting ? (
                <span className="text-shimmer">Writing…</span>
              ) : (
                <>
                  <CONCEPT_ICONS.agents size={ICON_SIZE.row} aria-hidden />
                  Write it for me
                </>
              )}
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
};

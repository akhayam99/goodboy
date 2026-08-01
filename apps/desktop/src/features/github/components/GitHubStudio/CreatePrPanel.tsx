import { useEffect, useMemo, useState } from 'react';
import type { SessionId } from '@goodboy/types';
import {
  Button,
  Checkbox,
  cn,
  Divider,
  FieldRow,
  Input,
  ScrollFade,
  SectionHeader,
  SegmentedTabs,
  Skeleton,
  Textarea,
} from '@goodboy/ui';
import { AlertTriangle, ArrowRight, GitBranch, PenLine, Sparkles } from 'lucide-react';
import { ghBaseBranches } from '../../github';
import { appendOperatorNotes } from '../../../session/utils/appendOperatorNotes';
import { AgentSpawnConfig } from '../../../session/components/AgentSpawnConfig';
import type { AgentSpawnConfigValue } from '../../../session/components/AgentSpawnConfig/AgentSpawnConfigValue';
import { taskModelAgentSpawnConfig } from '../../../session/components/AgentSpawnConfig/taskModelAgentSpawnConfig';
import { BranchCombobox } from '../../../worktree/BranchCombobox';
import type { LocalBranchInfo } from '../../../worktree/worktree';
import { useAppStore } from '../../../../store';
import { useSessionRepo } from '../../../../store/slices/worktrees/useSessionRepo';

type CreateMode = 'manual' | 'agent';

type Props = {
  readonly sessionId: SessionId;
  readonly defaultTitle: string;
  readonly closedPr?: { number: number; url: string };
  readonly onCreated: () => void;
  readonly onStudioClose: () => void;
  readonly onCancel?: () => void;
};

export const CreatePrPanel = ({
  sessionId,
  defaultTitle,
  closedPr,
  onCreated,
  onStudioClose,
  onCancel,
}: Props) => {
  const createPrForSession = useAppStore((s) => s.createPrForSession);
  const spawnAgent = useAppStore((s) => s.spawnAgent);
  const selectAgent = useAppStore((s) => s.selectAgent);
  const setCurrentSession = useAppStore((s) => s.setCurrentSession);
  const repo = useSessionRepo({ sessionId });
  const branch = repo?.branch ?? null;
  const workspaceRoot = repo?.repoRoot ?? null;
  const memberWorkspaceId = repo?.workspaceId;
  const session = useAppStore((s) => s.sessions.find((x) => x.id === sessionId) ?? null);
  const workspaceId = session?.workspaceId;
  const workspaceOverrides = useAppStore((s) =>
    workspaceId == null ? null : (s.workspaceOverrides?.[workspaceId] ?? null),
  );
  const resolvedAgentConfig = useMemo(
    () =>
      taskModelAgentSpawnConfig({
        task: 'pr_draft',
        preferences: workspaceOverrides?.taskModels,
        defaultProviderId: session?.providerPreference?.defaultProvider ?? 'anthropic',
      }),
    [workspaceOverrides?.taskModels, session?.providerPreference?.defaultProvider],
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

  const branchOptions = useMemo<ReadonlyArray<LocalBranchInfo>>(
    () => branches.map((name) => ({ name, inUse: false, hasUncommitted: false })),
    [branches],
  );

  useEffect(() => {
    if (agentConfigUserTouched) {
      return;
    }
    setAgentConfig(resolvedAgentConfig);
  }, [agentConfigUserTouched, resolvedAgentConfig]);

  useEffect(() => {
    if (workspaceRoot == null) {
      setBranchesLoading(false);
      return;
    }
    let cancelled = false;
    setBranchesLoading(true);
    void ghBaseBranches(workspaceRoot, workspaceId, memberWorkspaceId).then(
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
  }, [memberWorkspaceId, workspaceRoot, workspaceId]);

  const onCreate = async () => {
    if (busy || title.trim().length === 0) {
      return;
    }
    setBusy('create');
    setError(null);
    try {
      await createPrForSession(sessionId, { title, body, base, draft });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const onCreateWithAi = async () => {
    if (busy) {
      return;
    }
    setBusy('ai');
    setError(null);
    try {
      const prompt = [
        `Open a GitHub pull request for this session's branch.`,
        ...(closedPr
          ? [
              `- IMPORTANT: a previous PR #${closedPr.number} (${closedPr.url}) on this branch was CLOSED on purpose. Open a brand new pull request. Do NOT reopen #${closedPr.number}, and do not be confused if you find that closed PR while checking.`,
            ]
          : []),
        `- Write a clear, conventional title and a concise description from the committed changes.`,
        `- Session goal: "${defaultTitle}".`,
        `- If this project defines a PR-creation skill, command, or template (look under .claude/), follow it.`,
        `- Open it as a ${draft ? 'draft' : 'ready-for-review'} PR.`,
        `Then run \`gh pr create\` to open it and report the PR URL.`,
      ].join('\n');
      const agentId = await spawnAgent(sessionId, {
        name: 'open pull request',
        initialPrompt: appendOperatorNotes({ prompt, hint: agentConfig.hint }),
        model: agentConfig.model,
        ...(agentConfig.provider !== '' && { provider: agentConfig.provider }),
        effort: agentConfig.effort,
      });
      await setCurrentSession(sessionId);
      await selectAgent(sessionId, agentId);
      onStudioClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(null);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScrollFade className="min-h-0 flex-1" viewportClassName="px-6 py-5" fadeSize={24}>
        <section className="mx-auto flex w-full max-w-2xl flex-col gap-6">
          <SectionHeader
            label="Open a pull request"
            action={
              <span className="inline-flex items-center gap-1 font-mono text-2xs text-muted-foreground">
                <GitBranch size={11} aria-hidden />
                {branch ?? 'no branch'}
              </span>
            }
          />
          <section className="flex flex-col">
            <SectionHeader
              label="How"
              hint="Fill the pull request yourself, or hand it to an agent that drafts and opens it."
              action={
                <SegmentedTabs
                  ariaLabel="Creation mode"
                  size="sm"
                  options={[
                    { value: 'manual', label: 'Manual', icon: PenLine },
                    { value: 'agent', label: 'With an agent', icon: Sparkles },
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
                    className="h-8 w-full text-sm sm:w-96"
                    autoFocus
                  />
                </FieldRow>
                <Divider />
                <FieldRow label="Description" help="What changed and why. Markdown supported.">
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="What changed and why"
                    className="w-full text-sm sm:w-96"
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
                help="Routing and optional notes for the agent that drafts the title and description, then opens the pull request."
              >
                <AgentSpawnConfig
                  value={agentConfig}
                  onChange={(value) => {
                    setAgentConfigUserTouched(true);
                    setAgentConfig(value);
                  }}
                  disabled={busy !== null}
                />
              </FieldRow>
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

      <footer className="flex shrink-0 items-center gap-3 px-6 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {error != null && (
            <span
              role="alert"
              className="inline-flex min-w-0 items-center gap-1 truncate text-xs text-danger"
              title={error}
            >
              <AlertTriangle size={12} aria-hidden className="shrink-0" />
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
            disabled={busy !== null || title.trim().length === 0}
            className={cn(busy === 'create' && 'animate-border-pulse')}
          >
            {busy === 'create' ? (
              'Creating…'
            ) : (
              <>
                Create PR
                <ArrowRight size={13} aria-hidden />
              </>
            )}
          </Button>
        ) : (
          <Button
            onClick={() => void onCreateWithAi()}
            disabled={busy !== null}
            className={cn(busy === 'ai' && 'animate-border-pulse')}
          >
            {busy === 'ai' ? (
              'Drafting…'
            ) : (
              <>
                <Sparkles size={13} aria-hidden />
                Draft with agent
              </>
            )}
          </Button>
        )}
      </footer>
    </div>
  );
};

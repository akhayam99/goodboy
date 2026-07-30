import { useEffect, useMemo, useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { Button, cn, Divider, Input, ScrollFade, SectionHeader, Textarea } from '@goodboy/ui';
import { AlertTriangle, ArrowRight, GitBranch, Sparkles } from 'lucide-react';
import { ghBaseBranches } from '../../github';
import { appendOperatorNotes } from '../../../session/utils/appendOperatorNotes';
import { AgentSpawnConfig } from '../../../session/components/AgentSpawnConfig';
import type { AgentSpawnConfigValue } from '../../../session/components/AgentSpawnConfig/AgentSpawnConfigValue';
import { taskModelAgentSpawnConfig } from '../../../session/components/AgentSpawnConfig/taskModelAgentSpawnConfig';
import { useAppStore } from '../../../../store';

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
  const branch = useAppStore((s) => s.sessionBranches[sessionId] ?? null);
  const workspaceRoot = useAppStore((s) => {
    const sess = s.sessions.find((x) => x.id === sessionId);
    const ws = sess ? s.workspaces.find((w) => w.id === sess.workspaceId) : undefined;
    return ws?.rootPath ?? null;
  });
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

  const [title, setTitle] = useState(defaultTitle);
  const [body, setBody] = useState('');
  const [base, setBase] = useState('');
  const [branches, setBranches] = useState<ReadonlyArray<string>>([]);
  const [draft, setDraft] = useState(true);
  const [busy, setBusy] = useState<'create' | 'ai' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agentConfig, setAgentConfig] = useState<AgentSpawnConfigValue>(resolvedAgentConfig);
  const [agentConfigUserTouched, setAgentConfigUserTouched] = useState(false);

  useEffect(() => {
    if (agentConfigUserTouched) {
      return;
    }
    setAgentConfig(resolvedAgentConfig);
  }, [agentConfigUserTouched, resolvedAgentConfig]);

  useEffect(() => {
    if (!workspaceRoot) {
      return;
    }
    let cancelled = false;
    void ghBaseBranches(workspaceRoot, workspaceId).then(({ defaultBranch, branches: list }) => {
      if (cancelled) {
        return;
      }
      setBranches(list);
      if (defaultBranch) {
        setBase((cur) => (cur.trim() === '' ? defaultBranch : cur));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceRoot, workspaceId]);

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
      <ScrollFade className="min-h-0 flex-1" viewportClassName="px-10 py-8" fadeSize={24}>
        <section className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          <SectionHeader
            label="open a pull request"
            action={
              <span className="inline-flex items-center gap-1 font-mono text-2xs text-muted-foreground">
                <GitBranch size={11} aria-hidden />
                {branch ?? 'no branch'}
              </span>
            }
          />
          <div className="flex flex-col gap-1.5">
            <SectionHeader label="title" />
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="pull request title"
              disabled={busy !== null}
              aria-label="Pull request title"
              className="h-8 text-sm"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <SectionHeader label="description" />
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="what changed and why (markdown supported)"
              className="text-sm"
              autoGrow
              minRows={3}
              maxRows={12}
              disabled={busy !== null}
              aria-label="Pull request description"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <SectionHeader label="base branch" icon={<GitBranch size={13} aria-hidden />} />
            <Input
              value={base}
              onChange={(e) => setBase(e.target.value)}
              placeholder="default branch"
              list="pr-base-branches"
              className="h-8 font-mono text-sm"
              disabled={busy !== null}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              aria-label="Base branch"
            />
            <datalist id="pr-base-branches">
              {branches.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </div>
          <AgentSpawnConfig
            value={agentConfig}
            onChange={(value) => {
              setAgentConfigUserTouched(true);
              setAgentConfig(value);
            }}
            disabled={busy !== null}
          />
        </section>
      </ScrollFade>

      <Divider />

      <footer className="shrink-0">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-10 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={draft}
                onChange={(e) => setDraft(e.target.checked)}
                className="accent-primary"
                disabled={busy !== null}
              />
              Mark as draft
            </label>
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
          <div className="flex shrink-0 items-center gap-2">
            {onCancel != null && (
              <Button variant="ghost" onClick={onCancel} disabled={busy !== null}>
                Cancel
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => void onCreateWithAi()}
              disabled={busy !== null}
              title="hand it to an agent: it drafts the title and description, then opens the PR"
              className={cn(busy === 'ai' && 'animate-border-pulse')}
            >
              <Sparkles size={13} className="mr-1.5" aria-hidden />
              Draft with an agent
            </Button>
            <Button
              onClick={() => void onCreate()}
              disabled={busy !== null || title.trim().length === 0}
              className={cn(busy === 'create' && 'animate-border-pulse')}
            >
              Create PR
              <ArrowRight size={13} className="ml-1.5" aria-hidden />
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
};

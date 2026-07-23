import { useEffect, useMemo, useState } from 'react';
import { Button, Divider, EmptyState, Input, SectionHeader, Textarea, cn } from '@goodboy/ui';
import {
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  GitBranch,
  GitMerge,
  MousePointerClick,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { ScrollFade } from '@goodboy/ui';
import { appendOperatorNotes } from '../../../session/utils/appendOperatorNotes';
import { AgentSpawnConfig } from '../../../session/components/AgentSpawnConfig';
import type { AgentSpawnConfigValue } from '../../../session/components/AgentSpawnConfig/AgentSpawnConfigValue';
import { taskModelAgentSpawnConfig } from '../../../session/components/AgentSpawnConfig/taskModelAgentSpawnConfig';
import { useAppStore } from '../../../../store';
import { useToast } from '../../../../app/components/Toast';
import { formatError } from '../../../../shared/lib/errors';
import {
  gitlabMergeMr,
  humanizeMergeStatus,
  type GitlabMergeRequest,
  type GitlabMergeStatusTone,
} from '../client';
import { projectPathFromMrUrl } from './useGitlabMrs';

type Props = {
  readonly sessionId?: SessionId | null;
  readonly mr?: GitlabMergeRequest | null;
  readonly workspaceId?: WorkspaceId;
  readonly host?: string | null;
  readonly onRefresh?: () => void;
  readonly onClose: () => void;
};

const STATE_STYLE: Record<string, string> = {
  opened: 'bg-success/15 text-success',
  merged: 'bg-info/15 text-info',
  closed: 'bg-danger/15 text-danger',
  locked: 'bg-muted text-muted-foreground',
};

const MERGE_STATUS_STYLE: Record<GitlabMergeStatusTone, string> = {
  success: 'bg-success/15 text-success',
  danger: 'bg-danger/15 text-danger',
  muted: 'bg-muted text-muted-foreground',
};

export const MrDetailPanel = ({
  sessionId = null,
  mr: selectedMr = null,
  workspaceId,
  host,
  onRefresh,
  onClose,
}: Props) => {
  const session = useAppStore((s) =>
    sessionId == null ? null : (s.sessions.find((x) => x.id === sessionId) ?? null),
  );
  const mrState = useAppStore((s) =>
    sessionId == null ? undefined : s.sessionGitlabMr[sessionId],
  );
  const sessionBranch = useAppStore((s) =>
    sessionId == null ? null : (s.sessionBranches[sessionId] ?? null),
  );
  const refreshSessionMr = useAppStore((s) => s.refreshSessionMr);
  const createMrForSession = useAppStore((s) => s.createMrForSession);
  const mergeMrForSession = useAppStore((s) => s.mergeMrForSession);
  const spawnAgent = useAppStore((s) => s.spawnAgent);
  const selectAgent = useAppStore((s) => s.selectAgent);
  const setCurrentSession = useAppStore((s) => s.setCurrentSession);
  const workspaceOverrides = useAppStore((s) =>
    session == null ? null : (s.workspaceOverrides?.[session.workspaceId] ?? null),
  );
  const resolvedAgentConfig = useMemo(
    () =>
      taskModelAgentSpawnConfig({
        preferences: workspaceOverrides?.taskModels,
        defaultProviderId: session?.providerPreference?.defaultProvider ?? 'anthropic',
      }),
    [workspaceOverrides?.taskModels, session?.providerPreference?.defaultProvider],
  );
  const { showToast } = useToast();

  const mr = selectedMr ?? mrState?.mr ?? null;
  const mergeProjectPath = mr == null ? null : projectPathFromMrUrl({ webUrl: mr.webUrl });
  const branch = selectedMr?.sourceBranch ?? sessionBranch;
  const loading = mrState?.loading ?? false;
  const error = mrState?.error ?? null;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetBranch, setTargetBranch] = useState('main');
  const [draft, setDraft] = useState(true);
  const [busy, setBusy] = useState<'create' | 'ai' | 'merge' | null>(null);
  const [agentConfig, setAgentConfig] = useState<AgentSpawnConfigValue>(resolvedAgentConfig);
  const [agentConfigUserTouched, setAgentConfigUserTouched] = useState(false);

  useEffect(() => {
    if (agentConfigUserTouched) {
      return;
    }
    setAgentConfig(resolvedAgentConfig);
  }, [agentConfigUserTouched, resolvedAgentConfig]);

  useEffect(() => {
    if (sessionId == null) {
      return;
    }
    void refreshSessionMr(sessionId, { silent: true });
  }, [sessionId, refreshSessionMr]);

  useEffect(() => {
    setTitle(session?.goal ?? '');
  }, [session?.goal]);

  if (sessionId != null && session == null) {
    return (
      <div className="flex h-full items-center justify-center px-8">
        <EmptyState
          icon={MousePointerClick}
          title="No session selected"
          description="Pick a session to manage its merge request."
        />
      </div>
    );
  }

  if (sessionId == null && mr == null) {
    return (
      <div className="flex h-full items-center justify-center px-8">
        <EmptyState
          icon={MousePointerClick}
          title="No merge request selected"
          description="Pick a merge request to see its details."
        />
      </div>
    );
  }

  const onCreate = async () => {
    if (sessionId == null || busy !== null || title.trim().length === 0) {
      return;
    }
    setBusy('create');
    try {
      await createMrForSession(sessionId, {
        title: title.trim(),
        description,
        targetBranch: targetBranch.trim() || 'main',
        draft,
      });
      showToast('success', 'Merge request created');
    } catch (err) {
      showToast('error', formatError(err));
    } finally {
      setBusy(null);
    }
  };

  const onCreateWithAi = async () => {
    if (sessionId == null || session == null || busy !== null) {
      return;
    }
    setBusy('ai');
    try {
      const prompt = [
        `Open a GitLab merge request for this session's branch.`,
        `- Write a clear, conventional title and a concise description from the committed changes.`,
        `- Session goal: "${session.goal}".`,
        `- Target branch: ${targetBranch.trim() || 'main'}.`,
        `- If this project defines an MR-creation skill, command, or template (look under .claude/), follow it.`,
        `- Open it as a ${draft ? 'draft' : 'ready-for-review'} merge request.`,
        `Then open it with \`glab mr create\` (or the GitLab REST API if glab is unavailable) and report the MR URL.`,
      ].join('\n');
      const agentId = await spawnAgent(sessionId, {
        name: 'open merge request',
        initialPrompt: appendOperatorNotes({ prompt, hint: agentConfig.hint }),
        model: agentConfig.model,
        ...(agentConfig.provider !== '' && { provider: agentConfig.provider }),
        effort: agentConfig.effort,
      });
      await setCurrentSession(sessionId);
      await selectAgent(sessionId, agentId);
      onClose();
    } catch (err) {
      showToast('error', formatError(err));
      setBusy(null);
    }
  };

  const onMerge = async () => {
    if (busy !== null) {
      return;
    }
    setBusy('merge');
    try {
      if (sessionId != null) {
        await mergeMrForSession(sessionId);
      } else if (mr != null && workspaceId != null && host != null && mergeProjectPath != null) {
        await gitlabMergeMr(workspaceId, host, mergeProjectPath, mr.iid);
        onRefresh?.();
      }
      showToast('success', 'Merge request merged');
      onClose();
    } catch (err) {
      showToast('error', formatError(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 px-8 py-4">
        <span className="inline-flex items-center gap-1.5 font-mono text-2xs text-muted-foreground">
          <GitBranch size={11} aria-hidden />
          {branch ?? 'no branch'}
        </span>
        {mr ? (
          <span
            className={cn(
              'rounded px-1.5 py-0.5 text-2xs font-medium',
              STATE_STYLE[mr.state] ?? 'bg-muted text-muted-foreground',
            )}
          >
            !{mr.iid} · {mr.state}
          </span>
        ) : null}
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => {
            if (sessionId != null) {
              void refreshSessionMr(sessionId, { force: true });
              return;
            }
            onRefresh?.();
          }}
          disabled={loading}
          title={error ? `refresh failed: ${error}` : 'refresh merge request'}
          aria-label="refresh merge request"
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground ring-1 ring-border-soft/40 transition-colors hover:bg-foreground/5 hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw size={12} aria-hidden />
        </button>
        {mr ? (
          <a
            href={mr.webUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-2xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Open in GitLab <ExternalLink size={11} aria-hidden />
          </a>
        ) : null}
      </div>
      <Divider />

      <div className="min-h-0 flex-1">
        <ScrollFade
          className="mx-auto h-full max-w-3xl"
          viewportClassName="px-10 py-8"
          fadeSize={24}
        >
          {mr ? (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <h2 className="text-lg font-semibold leading-snug text-foreground">{mr.title}</h2>
                <span className="inline-flex items-center gap-1.5 text-2xs text-muted-foreground">
                  <span className="font-mono">{mr.sourceBranch}</span>
                  <ArrowRight size={11} aria-hidden />
                  <span className="font-mono">{mr.targetBranch}</span>
                  {mr.draft ? (
                    <span className="rounded bg-warning/15 px-1.5 py-0.5 font-medium text-warning">
                      draft
                    </span>
                  ) : null}
                </span>
              </div>

              {mr.hasConflicts ? (
                <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5 text-2xs leading-relaxed text-foreground">
                  <AlertTriangle size={12} aria-hidden className="mt-0.5 shrink-0 text-warning" />
                  <span>
                    This merge request has conflicts that must be resolved before merging.
                  </span>
                </div>
              ) : null}

              {mr.state === 'opened' ? (
                <div className="flex items-center gap-3">
                  {(() => {
                    const status = humanizeMergeStatus(mr.mergeStatus);
                    return status ? (
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-2xs font-medium',
                          MERGE_STATUS_STYLE[status.tone],
                        )}
                      >
                        {status.label}
                      </span>
                    ) : null;
                  })()}
                  <span className="flex-1" />
                  <Button
                    onClick={() => void onMerge()}
                    disabled={
                      busy !== null ||
                      mr.hasConflicts ||
                      mr.mergeStatus === 'cannot_be_merged' ||
                      (sessionId == null && mergeProjectPath == null)
                    }
                    className={busy === 'merge' ? 'animate-border-pulse' : undefined}
                  >
                    {busy === 'merge' ? (
                      'Merging…'
                    ) : (
                      <>
                        <GitMerge size={13} className="mr-1.5" aria-hidden />
                        Merge request
                      </>
                    )}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : session != null && sessionId != null ? (
            <section className="flex flex-col gap-4">
              <SectionHeader label="create merge request" />
              <div className="flex flex-col gap-4 rounded-lg border border-border-soft bg-muted/10 p-4">
                <div className="flex flex-col gap-1.5">
                  <SectionHeader label="title" />
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={busy !== null}
                    aria-label="Merge request title"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <SectionHeader label="description" />
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    autoGrow
                    minRows={3}
                    maxRows={10}
                    disabled={busy !== null}
                    aria-label="Merge request description"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <SectionHeader label="target branch" icon={<GitBranch size={13} aria-hidden />} />
                  <Input
                    value={targetBranch}
                    onChange={(e) => setTargetBranch(e.target.value)}
                    placeholder="main"
                    className="h-8 font-mono text-sm"
                    disabled={busy !== null}
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    aria-label="Target branch"
                  />
                </div>
                <AgentSpawnConfig
                  value={agentConfig}
                  onChange={(value) => {
                    setAgentConfigUserTouched(true);
                    setAgentConfig(value);
                  }}
                  disabled={busy !== null}
                />
                <div className="flex items-center gap-3 pt-1">
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
                  <span className="flex-1" />
                  <Button
                    variant="secondary"
                    onClick={() => void onCreateWithAi()}
                    disabled={busy !== null || !branch}
                    title="hand it to an agent: it drafts the title and description, then opens the MR"
                    className={busy === 'ai' ? 'animate-border-pulse' : undefined}
                  >
                    {busy === 'ai' ? null : <Sparkles size={13} className="mr-1.5" aria-hidden />}
                    Draft with an agent
                  </Button>
                  <Button
                    onClick={() => void onCreate()}
                    disabled={busy !== null || title.trim().length === 0 || !branch}
                    className={busy === 'create' ? 'animate-border-pulse' : undefined}
                  >
                    {busy === 'create' ? (
                      'Creating…'
                    ) : (
                      <>
                        Create MR
                        <ArrowRight size={13} className="ml-1.5" aria-hidden />
                      </>
                    )}
                  </Button>
                </div>
                {error ? <span className="text-xs text-danger">{error}</span> : null}
              </div>
            </section>
          ) : null}
        </ScrollFade>
      </div>
    </div>
  );
};

import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  Divider,
  EmptyState,
  FieldRow,
  Input,
  Markdown,
  SectionHeader,
  SegmentedTabs,
  Textarea,
} from '@goodboy/ui';
import {
  AlertTriangle,
  ArrowRight,
  GitBranch,
  GitMerge,
  MousePointerClick,
  PenLine,
  Sparkles,
} from 'lucide-react';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import {
  DetailSection,
  HeaderBand,
  MetaItem,
  StudioDetailLayout,
} from '../../../../shared/components/StudioDetail';
import { gitlabMergeRequestFields, resolveDetailFields } from '../../../../shared/detail-fields';
import { IssueStateBadge, type StateTone } from '../../../../shared/components/IssueStateBadge';
import { BranchPair } from '../../../../shared/components/BranchPair';
import { ExternalRefActions } from '../../../../shared/components/ExternalRefActions';
import { RefreshIconButton } from '../../../../shared/components/RefreshIconButton';
import { appendOperatorNotes } from '../../../session/utils/appendOperatorNotes';
import { AgentSpawnConfig } from '../../../session/components/AgentSpawnConfig';
import type { AgentSpawnConfigValue } from '../../../session/components/AgentSpawnConfig/AgentSpawnConfigValue';
import { taskModelAgentSpawnConfig } from '../../../session/components/AgentSpawnConfig/taskModelAgentSpawnConfig';
import { useAppStore } from '../../../../store';
import { useToast } from '../../../../app/components/Toast';
import { formatError } from '../../../../shared/lib/errors';
import { gitlabMergeMr, type GitlabMergeRequest } from '../client';
import { projectPathFromMrUrl } from './useGitlabMrs';

type CreateMode = 'manual' | 'agent';

type Props = {
  readonly sessionId?: SessionId | null;
  readonly mr?: GitlabMergeRequest | null;
  readonly workspaceId?: WorkspaceId;
  readonly host?: string | null;
  readonly onRefresh?: () => void;
  readonly onClose: () => void;
};

const STATE_TONE: Record<string, StateTone> = {
  opened: 'success',
  merged: 'info',
  closed: 'danger',
  locked: 'neutral',
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
        task: 'pr_draft',
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

  const [mode, setMode] = useState<CreateMode>('manual');
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

  const refreshButton = (
    <RefreshIconButton
      label="refresh merge request"
      iconSize={12}
      isLoading={loading}
      error={error}
      onClick={() => {
        if (sessionId != null) {
          void refreshSessionMr(sessionId, { force: true });
          return;
        }
        onRefresh?.();
      }}
    />
  );

  if (mr != null) {
    return (
      <StudioDetailLayout
        header={
          <HeaderBand
            meta={
              <>
                <IssueStateBadge tone={STATE_TONE[mr.state] ?? 'neutral'}>
                  !{mr.iid} · {mr.state}
                </IssueStateBadge>
                {mr.draft ? <IssueStateBadge tone="warning">draft</IssueStateBadge> : null}
              </>
            }
            title={mr.title}
            subtitle={<BranchPair headBranch={mr.sourceBranch} baseBranch={mr.targetBranch} />}
            actions={
              <>
                {refreshButton}
                <ExternalRefActions url={mr.webUrl} label="MR" hostLabel="GitLab" />
                {mr.state === 'opened' ? (
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
                        <GitMerge size={13} aria-hidden />
                        Merge request
                      </>
                    )}
                  </Button>
                ) : null}
              </>
            }
          />
        }
        properties={resolveDetailFields({ registry: gitlabMergeRequestFields, entity: mr })}
      >
        {mr.hasConflicts ? (
          <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5 text-2xs leading-relaxed text-foreground">
            <AlertTriangle size={12} aria-hidden className="mt-0.5 shrink-0 text-warning" />
            <span>This merge request has conflicts that must be resolved before merging.</span>
          </div>
        ) : null}

        <DetailSection label="description">
          {mr.description != null && mr.description !== '' ? (
            <Markdown text={mr.description} className="text-sm leading-relaxed" />
          ) : (
            <p className="text-sm italic text-muted-foreground/60">No description.</p>
          )}
        </DetailSection>
      </StudioDetailLayout>
    );
  }

  return (
    <StudioDetailLayout
      header={
        <HeaderBand
          meta={
            <span className="inline-flex items-center gap-1.5 font-mono text-2xs text-muted-foreground">
              <GitBranch size={11} aria-hidden />
              {branch ?? 'no branch'}
            </span>
          }
          title="New merge request"
          actions={refreshButton}
        />
      }
      rail={
        <MetaItem label="Branch">
          <span className="font-mono">{branch ?? 'no branch'}</span>
        </MetaItem>
      }
    >
      {session != null && sessionId != null ? (
        <section className="flex flex-col gap-6">
          <section className="flex flex-col">
            <SectionHeader
              label="How"
              hint="Fill the merge request yourself, or hand it to an agent that drafts and opens it."
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
                    disabled={busy !== null}
                    aria-label="Merge request title"
                    className="h-8 w-full text-sm sm:w-96"
                  />
                </FieldRow>
                <Divider />
                <FieldRow label="Description" help="What changed and why. Markdown supported.">
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    autoGrow
                    minRows={3}
                    maxRows={10}
                    disabled={busy !== null}
                    aria-label="Merge request description"
                    className="w-full text-sm sm:w-96"
                  />
                </FieldRow>
                <Divider />
                <FieldRow label="Target branch" help="The branch this merge request merges into.">
                  <Input
                    value={targetBranch}
                    onChange={(e) => setTargetBranch(e.target.value)}
                    placeholder="main"
                    className="h-8 w-full font-mono text-sm sm:w-96"
                    disabled={busy !== null}
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    aria-label="Target branch"
                  />
                </FieldRow>
              </>
            ) : (
              <FieldRow
                label="Agent"
                layout="stacked"
                help="Routing and optional notes for the agent that drafts the title and description, then opens the merge request."
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
              help="Creates the merge request in GitLab's draft state."
            >
              <Checkbox checked={draft} onChange={setDraft} disabled={busy !== null} />
            </FieldRow>
          </section>

          <Divider />

          <footer className="flex shrink-0 items-center gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {error != null ? (
                <span
                  role="alert"
                  className="inline-flex min-w-0 items-center gap-1 truncate text-xs text-danger"
                  title={error}
                >
                  <AlertTriangle size={12} aria-hidden className="shrink-0" />
                  {error}
                </span>
              ) : null}
            </div>
            {mode === 'manual' ? (
              <Button
                onClick={() => void onCreate()}
                disabled={busy !== null || title.trim().length === 0 || branch == null}
                className={busy === 'create' ? 'animate-border-pulse' : undefined}
              >
                {busy === 'create' ? (
                  'Creating…'
                ) : (
                  <>
                    Create MR
                    <ArrowRight size={13} aria-hidden />
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={() => void onCreateWithAi()}
                disabled={busy !== null || branch == null}
                className={busy === 'ai' ? 'animate-border-pulse' : undefined}
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
        </section>
      ) : null}
    </StudioDetailLayout>
  );
};

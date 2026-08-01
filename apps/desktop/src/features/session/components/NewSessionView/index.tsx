import { invoke } from '@tauri-apps/api/core';
import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ScrollFade } from '@goodboy/ui';
import type { SessionId, WorkspaceId, WorkspaceIntegration } from '@goodboy/types';
import { resolveTaskModel } from '@goodboy/core';
import { toAttachmentInput } from '../../../chat/components/ChatInput/lib';
import { usePendingAttachments } from '../../../chat/components/ChatInput/hooks/usePendingAttachments';
import { settingBranchPrefix, DEFAULT_BRANCH_PREFIX } from '../../../../features/settings/settings';
import { useAppStore } from '../../../../store';
import { useToast } from '../../../../app/components/Toast';
import {
  listLocalBranches,
  removeWorktree,
  type LocalBranchInfo,
} from '../../../../features/worktree/worktree';
import { useBranchConflict } from '../../../../features/worktree/useBranchConflict';
import { useWorkspaceRemoteHostKind } from '../../../../features/worktree/useWorkspaceRemoteHostKind';
import type { IssueCandidate } from '../../../../features/integrations/fetchIssueCandidates';
import { resolveIssueSources } from '../../../../features/integrations/issueSources';
import { useGithubConnection } from '../../../../features/integrations/github/useGithubConnection';
import { formatError } from '../../../../shared/lib/errors';
import { isValidBranchSlug as validateBranchSlug } from '../../../../shared/utils/isValidBranchSlug';
import { sanitizeBranchPrefix } from '../../../../shared/utils/sanitizeBranchPrefix';
import { sanitizeBranchSlug as sanitizeBranchSlugValue } from '../../../../shared/utils/sanitizeBranchSlug';
import { slugifyBranch } from '../../../../shared/utils/slugifyBranch';
import { PROVIDER_ORDER } from '../../../providers/components/ProviderStudio/providerOrder';
import { useSetupWorkflowPreference } from '../../hooks/useSetupWorkflowPreference';
import { generateBranchSlug } from './generateBranchSlug';
import { NewSessionFooter } from './NewSessionFooter';
import { NewSessionForm } from './NewSessionForm';

type Props = {
  onClose: () => void;
  workspaceId: WorkspaceId;
  onOpenSettings: () => void;
};

const SLUG_MAX_LEN = 48;

const EMPTY_LOCAL_BRANCHES: ReadonlyArray<LocalBranchInfo> = [];

const EMPTY_INTEGRATIONS: ReadonlyArray<WorkspaceIntegration> = [];

export const NewSessionView = ({ onClose, workspaceId, onOpenSettings }: Props) => {
  const createSession = useAppStore((s) => s.createSession);
  const setCurrentSession = useAppStore((s) => s.setCurrentSession);
  const loadSetting = useAppStore((s) => s.loadSetting);
  const providers = useAppStore((s) => s.providers);
  const { showToast } = useToast();
  const settingKey = settingBranchPrefix(workspaceId);
  const workspace = useAppStore((s) => s.workspaces.find((w) => w.id === workspaceId));
  const isSimple = workspace?.kind === 'simple';
  const workspaceOverrides = useAppStore((s) => s.workspaceOverrides?.[workspaceId] ?? null);

  const [goal, setGoal] = useState('');
  const [branchSlug, setBranchSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [branchPrefix, setBranchPrefix] = useState(DEFAULT_BRANCH_PREFIX);
  const [slugGenerating, setSlugGenerating] = useState(false);
  const [branchMode, setBranchMode] = useState<'new' | 'existing'>('new');
  const [existingBranches, setExistingBranches] = useState<ReadonlyArray<LocalBranchInfo>>([]);
  const [existingBranch, setExistingBranch] = useState<string>('');
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchesLoaded, setBranchesLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState<IssueCandidate | null>(null);
  const [setupWorkflow, setSetupWorkflow] = useSetupWorkflowPreference();

  const {
    attachments,
    isDragging,
    composerRef,
    fileInputRef,
    onFileInputChange,
    removeAttachment,
  } = usePendingAttachments({ showToast });

  const workspaceIntegrations = useAppStore(
    useShallow((s) => s.workspaceIntegrations?.[workspaceId] ?? EMPTY_INTEGRATIONS),
  );
  const remoteKind = useWorkspaceRemoteHostKind({ workspaceId });
  const githubConnection = useGithubConnection({ workspaceId });
  const issueSources = isSimple
    ? []
    : resolveIssueSources({
        integrations: workspaceIntegrations,
        remoteKind,
        isGithubAuthenticated: githubConnection.isAuthenticated,
      });

  const connectedProviders = providers.filter((p) => p.connection === 'connected');
  const noProviderConnected = providers.length > 0 && connectedProviders.length === 0;
  const connectedProviderIds = new Set(connectedProviders.map((provider) => provider.id));
  const workspaceDefaultProvider = workspaceOverrides?.defaultProviderId;
  const defaultProvider =
    workspaceDefaultProvider != null && connectedProviderIds.has(workspaceDefaultProvider)
      ? workspaceDefaultProvider
      : (PROVIDER_ORDER.find((id) => connectedProviderIds.has(id)) ?? 'anthropic');

  useEffect(() => {
    if (isSimple) {
      return;
    }
    void loadSetting(settingKey).then((value) => {
      setBranchPrefix(value ?? DEFAULT_BRANCH_PREFIX);
    });
  }, [isSimple, settingKey, loadSetting]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || busy) {
        return;
      }
      if (document.querySelector('dialog[open]') != null) {
        return;
      }
      if (document.querySelector('[data-studio-overlay]') != null) {
        return;
      }
      e.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [busy, onClose]);

  const onPickIssue = (candidate: IssueCandidate) => {
    setIssue(candidate);
    setGoal(candidate.goal);
    setBranchSlug(candidate.branchSlug);
    setSlugTouched(true);
  };

  useEffect(() => {
    setExistingBranches(EMPTY_LOCAL_BRANCHES);
    setBranchesLoaded(false);
  }, [workspaceId]);

  useEffect(() => {
    if (isSimple || branchMode !== 'existing' || branchesLoaded || !workspace?.rootPath) {
      return;
    }
    setBranchesLoading(true);
    listLocalBranches(workspace.rootPath)
      .then(setExistingBranches)
      .catch(() => setExistingBranches([]))
      .finally(() => {
        setBranchesLoading(false);
        setBranchesLoaded(true);
      });
  }, [branchMode, branchesLoaded, isSimple, workspace?.rootPath]);

  useEffect(() => {
    if (slugTouched) {
      return;
    }
    setBranchSlug(slugifyBranch({ input: goal, maxLength: SLUG_MAX_LEN }));
  }, [goal, slugTouched]);

  const handleGenerateSlug = () => {
    const trimmed = goal.trim();
    if (trimmed === '' || slugGenerating) {
      return;
    }
    setSlugGenerating(true);
    const taskModel = resolveTaskModel(
      'branch_naming',
      workspaceOverrides?.taskModels,
      defaultProvider,
    );
    generateBranchSlug({
      goal: trimmed,
      ...taskModel,
      fallbackSlug: slugifyBranch({ input: trimmed, maxLength: SLUG_MAX_LEN }),
      invokeFn: invoke,
      ...(workspace?.rootPath != null && { workingDir: workspace.rootPath }),
    })
      .then((result) => {
        if (result.accepted) {
          setBranchSlug(result.slug);
          setSlugTouched(true);
          return;
        }
        if (!slugTouched) {
          setBranchSlug(result.slug);
        }
        showToast('warning', 'Branch name generation failed, kept the name derived from the goal', {
          context: result.error ?? 'unknown error',
        });
      })
      .finally(() => {
        setSlugGenerating(false);
      });
  };

  const conflict = useBranchConflict(
    !isSimple && branchMode === 'existing' ? existingBranch.trim() || null : null,
    workspace?.rootPath ?? null,
  );
  const conflictSessionId = conflict?.kind === 'session' ? conflict.sessionId : null;
  const conflictWorktreePath = conflict?.kind === 'worktree' ? conflict.path : null;

  const branchReady =
    isSimple ||
    (branchMode === 'new'
      ? validateBranchSlug({ slug: branchSlug })
      : existingBranch.trim().length > 0);
  const goalReady = goal.trim().length > 0;
  const canCreate =
    goalReady &&
    branchReady &&
    !busy &&
    !noProviderConnected &&
    conflictSessionId === null &&
    conflictWorktreePath === null;

  const onOpenConflictSession = (id: SessionId) => {
    void setCurrentSession(id);
    onClose();
  };

  const onCreate = async (eraseWorktreePath?: string) => {
    setError(null);
    setBusy(true);
    try {
      if (!isSimple && eraseWorktreePath && workspace?.rootPath) {
        await removeWorktree(workspace.rootPath, eraseWorktreePath);
      }
      const useExisting =
        !isSimple && branchMode === 'existing' && existingBranch.trim().length > 0;
      await createSession({
        workspaceId,
        goal,
        ...(!isSimple
          ? {
              branchPrefix:
                sanitizeBranchPrefix({ input: branchPrefix }).trim() || DEFAULT_BRANCH_PREFIX,
              branchSlug: branchSlug.trim() || undefined,
            }
          : {}),
        ...(useExisting ? { existingBranch: existingBranch.trim() } : {}),
        ...(issue
          ? {
              externalTask: {
                provider: issue.provider,
                externalId: issue.externalId,
                identifier: issue.identifier,
                url: issue.url,
                title: issue.title,
              },
            }
          : {}),
        ...(attachments.length > 0 ? { attachmentInputs: attachments.map(toAttachmentInput) } : {}),
        openWorkflowBuilder: setupWorkflow,
      });
      onClose();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full w-full items-center justify-center bg-background py-6 motion-safe:animate-studio-in">
      <div className="flex h-full max-h-full w-full max-w-2xl flex-col overflow-hidden">
        <ScrollFade className="min-h-0 flex-1" viewportClassName="px-6 py-5" fadeSize={24}>
          <NewSessionForm
            workspaceId={workspaceId}
            isSimple={isSimple}
            noProviderConnected={noProviderConnected}
            onOpenSettings={onOpenSettings}
            issueSources={issueSources}
            issue={issue}
            onPickIssue={onPickIssue}
            onClearIssue={() => setIssue(null)}
            goal={goal}
            onGoalChange={setGoal}
            attachments={attachments}
            isDragging={isDragging}
            composerRef={composerRef}
            fileInputRef={fileInputRef}
            onFileInputChange={onFileInputChange}
            onRemoveAttachment={removeAttachment}
            branchMode={branchMode}
            onBranchModeChange={setBranchMode}
            branchPrefix={sanitizeBranchPrefix({ input: branchPrefix })}
            branchSlug={branchSlug}
            onBranchSlugChange={(value) => {
              setBranchSlug(sanitizeBranchSlugValue({ input: value, maxLength: SLUG_MAX_LEN }));
              setSlugTouched(true);
            }}
            slugGenerating={slugGenerating}
            onGenerateSlug={handleGenerateSlug}
            existingBranches={existingBranches}
            existingBranch={existingBranch}
            onExistingBranchChange={setExistingBranch}
            branchesLoading={branchesLoading}
            conflictSessionId={conflictSessionId}
            conflictWorktreePath={conflictWorktreePath}
            busy={busy}
          />
        </ScrollFade>
        <NewSessionFooter
          isSimple={isSimple}
          error={error}
          setupWorkflow={setupWorkflow}
          onSetupWorkflowChange={setSetupWorkflow}
          busy={busy}
          onClose={onClose}
          conflictSessionId={conflictSessionId}
          conflictWorktreePath={conflictWorktreePath}
          goalReady={goalReady}
          canCreate={canCreate}
          onOpenConflictSession={onOpenConflictSession}
          onCreate={onCreate}
        />
      </div>
    </div>
  );
};

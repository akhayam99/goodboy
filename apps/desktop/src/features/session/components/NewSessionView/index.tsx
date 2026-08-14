import { invoke } from '@tauri-apps/api/core';
import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { formatError, ScrollFade } from '@goodboy/ui';
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
import { useSimpleSessionDirectoryConflict } from '../../../../features/worktree/useSimpleSessionDirectoryConflict';
import { useWorkspaceGitStatus } from '../../../workspace/hooks/useWorkspaceGitStatus';
import type { IssueCandidate } from '../../../../features/integrations/fetchIssueCandidates';
import { resolveIssueSources } from '../../../../features/integrations/issueSources';
import { useGithubConnection } from '../../../../features/integrations/github/useGithubConnection';
import { isValidBranchSlug as validateBranchSlug } from '../../../../shared/utils/isValidBranchSlug';
import { sanitizeBranchPrefix } from '../../../../shared/utils/sanitizeBranchPrefix';
import { sanitizeBranchSlug as sanitizeBranchSlugValue } from '../../../../shared/utils/sanitizeBranchSlug';
import { slugifyBranch } from '../../../../shared/utils/slugifyBranch';
import { validateSessionDirectoryName } from '../../../../shared/utils/validateSessionDirectoryName';
import { deriveDefaultSessionDirectoryNameFromGoal } from '../../../../shared/utils/deriveDefaultSessionDirectoryNameFromGoal';
import { buildSimpleSessionDirectoryPath } from '../../../../shared/utils/buildSimpleSessionDirectoryPath';
import { sessionDirectoryNameValidationMessage } from '../../../../shared/utils/sessionDirectoryNameValidationMessage';
import { PROVIDER_ORDER } from '../../../providers/components/ProviderStudio/providerOrder';
import { EMPTY_NEW_SESSION_DRAFT } from '../../../../store/slices/newSessionDrafts/emptyNewSessionDraft';
import { generateBranchSlug } from './generateBranchSlug';
import { GoalEditor } from './GoalEditor';
import { NewSessionBlocked } from './NewSessionBlocked';
import { NewSessionFooter } from './NewSessionFooter';
import { NewSessionForm } from './NewSessionForm';
import { polishGoal } from './polishGoal';
import { PANE_RHYTHM } from '@goodboy/ui';

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
  const setNewSessionDraft = useAppStore((s) => s.setNewSessionDraft);
  const clearNewSessionDraft = useAppStore((s) => s.clearNewSessionDraft);
  const draft = useAppStore((s) => s.newSessionDrafts[workspaceId] ?? EMPTY_NEW_SESSION_DRAFT);
  const providers = useAppStore((s) => s.providers);
  const { showToast } = useToast();
  const settingKey = settingBranchPrefix(workspaceId);
  const workspace = useAppStore((s) => s.workspaces.find((w) => w.id === workspaceId));
  const isSimple = workspace?.kind === 'simple';
  const gitStatus = useWorkspaceGitStatus({ workspaceId });
  const workspaceOverrides = useAppStore((s) => s.workspaceOverrides?.[workspaceId] ?? null);

  const {
    goal,
    branchSlug,
    slugTouched,
    folderName,
    folderNameTouched,
    branchMode,
    existingBranch,
    issue,
  } = draft;
  const [branchPrefix, setBranchPrefix] = useState(DEFAULT_BRANCH_PREFIX);
  const [slugGenerating, setSlugGenerating] = useState(false);
  const [existingBranches, setExistingBranches] = useState<ReadonlyArray<LocalBranchInfo>>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchesLoaded, setBranchesLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [goalEditorOpen, setGoalEditorOpen] = useState(false);
  const [goalEditorDraft, setGoalEditorDraft] = useState('');
  const [goalEditorDirty, setGoalEditorDirty] = useState(false);
  const [goalPolishing, setGoalPolishing] = useState(false);
  const goalPolishRequestId = useRef(0);
  const goalEditorBaseRef = useRef(goal);

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
  const githubConnection = useGithubConnection({ workspaceId });
  const issueSources = isSimple
    ? []
    : resolveIssueSources({
        integrations: workspaceIntegrations,
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
      clearNewSessionDraft({ workspaceId });
      onClose();
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [busy, clearNewSessionDraft, onClose, workspaceId]);

  const onPickIssue = (candidate: IssueCandidate) => {
    setNewSessionDraft({
      workspaceId,
      draft: {
        issue: candidate,
        goal: candidate.goal,
        branchSlug: candidate.branchSlug,
        slugTouched: true,
      },
    });
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
    const nextBranchSlug = slugifyBranch({ input: goal, maxLength: SLUG_MAX_LEN });
    if (nextBranchSlug === branchSlug) {
      return;
    }
    setNewSessionDraft({ workspaceId, draft: { branchSlug: nextBranchSlug } });
  }, [branchSlug, goal, setNewSessionDraft, slugTouched, workspaceId]);

  useEffect(() => {
    if (!isSimple || folderNameTouched) {
      return;
    }
    const nextFolderName = deriveDefaultSessionDirectoryNameFromGoal({ goal });
    if (nextFolderName === folderName) {
      return;
    }
    setNewSessionDraft({ workspaceId, draft: { folderName: nextFolderName } });
  }, [folderName, folderNameTouched, goal, isSimple, setNewSessionDraft, workspaceId]);

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
          setNewSessionDraft({
            workspaceId,
            draft: { branchSlug: result.slug, slugTouched: true },
          });
          return;
        }
        if (!slugTouched) {
          setNewSessionDraft({ workspaceId, draft: { branchSlug: result.slug } });
        }
        showToast('warning', 'Branch name generation failed, kept the name derived from the goal', {
          context: result.error ?? 'unknown error',
        });
      })
      .finally(() => {
        setSlugGenerating(false);
      });
  };

  useEffect(() => {
    if (goalEditorOpen || goal === goalEditorBaseRef.current) {
      return;
    }
    goalEditorBaseRef.current = goal;
    setGoalEditorDraft(goal);
    setGoalEditorDirty(false);
  }, [goal, goalEditorOpen]);

  const openGoalEditor = () => {
    goalPolishRequestId.current += 1;
    setGoalPolishing(false);
    if (!goalEditorDirty) {
      goalEditorBaseRef.current = goal;
      setGoalEditorDraft(goal);
    }
    setGoalEditorOpen(true);
  };

  const cancelGoalEditor = () => {
    goalPolishRequestId.current += 1;
    setGoalPolishing(false);
    setGoalEditorOpen(false);
  };

  const updateGoalEditorDraft = (value: string) => {
    setGoalEditorDraft(value);
    setGoalEditorDirty(value !== goalEditorBaseRef.current);
  };

  const saveGoalEditor = () => {
    goalPolishRequestId.current += 1;
    setNewSessionDraft({ workspaceId, draft: { goal: goalEditorDraft } });
    goalEditorBaseRef.current = goalEditorDraft;
    setGoalEditorDirty(false);
    setGoalEditorOpen(false);
    setGoalEditorDraft('');
  };

  const handlePolishGoal = () => {
    if (goalEditorDraft.trim().length === 0 || goalPolishing) {
      return;
    }
    const requestId = goalPolishRequestId.current + 1;
    goalPolishRequestId.current = requestId;
    setGoalPolishing(true);
    const taskModel = resolveTaskModel(
      'prose_polish',
      workspaceOverrides?.taskModels,
      defaultProvider,
    );
    polishGoal({
      goal: goalEditorDraft,
      ...taskModel,
      invokeFn: invoke,
      ...(workspace?.rootPath != null && { workingDir: workspace.rootPath }),
    })
      .then((result) => {
        if (goalPolishRequestId.current !== requestId) {
          return;
        }
        if (result.accepted) {
          updateGoalEditorDraft(result.goal);
          return;
        }
        showToast('warning', 'Could not polish the goal, kept your wording', {
          context: result.error ?? 'unknown error',
        });
      })
      .finally(() => {
        if (goalPolishRequestId.current !== requestId) {
          return;
        }
        setGoalPolishing(false);
      });
  };

  const conflict = useBranchConflict(
    !isSimple && branchMode === 'existing' ? existingBranch.trim() || null : null,
    workspace?.rootPath ?? null,
  );
  const conflictSessionId = conflict?.kind === 'session' ? conflict.sessionId : null;
  const conflictWorktreePath = conflict?.kind === 'worktree' ? conflict.path : null;
  const folderValidation = validateSessionDirectoryName({ name: folderName });
  const folderNameError = sessionDirectoryNameValidationMessage({ validation: folderValidation });
  const folderPathPreview =
    isSimple && workspace?.rootPath != null
      ? buildSimpleSessionDirectoryPath({
          workspaceRoot: workspace.rootPath,
          folderName,
        })
      : null;
  const folderConflictPath =
    isSimple && folderValidation.ok && folderPathPreview != null ? folderPathPreview : null;
  const folderConflict = useSimpleSessionDirectoryConflict({ path: folderConflictPath });

  const branchReady =
    isSimple ||
    (branchMode === 'new'
      ? validateBranchSlug({ slug: branchSlug })
      : existingBranch.trim().length > 0);
  const goalReady = goal.trim().length > 0;
  const folderReady =
    !isSimple || (folderValidation.ok && !folderConflict.exists && !folderConflict.checking);
  const canCreate =
    goalReady &&
    branchReady &&
    folderReady &&
    !busy &&
    !noProviderConnected &&
    conflictSessionId === null &&
    conflictWorktreePath === null;

  const onOpenConflictSession = (id: SessionId) => {
    void setCurrentSession(id);
    onClose();
  };

  const onCancel = () => {
    clearNewSessionDraft({ workspaceId });
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
        ...(isSimple
          ? { folderName }
          : {
              branchPrefix:
                sanitizeBranchPrefix({ input: branchPrefix }).trim() || DEFAULT_BRANCH_PREFIX,
              branchSlug: branchSlug.trim() || undefined,
            }),
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
      });
      clearNewSessionDraft({ workspaceId });
      onClose();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  if (gitStatus !== null && gitStatus.state !== 'ready' && workspace?.rootPath != null) {
    return (
      <NewSessionBlocked rootPath={workspace.rootPath} status={gitStatus} onClose={onCancel} />
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-background py-6 motion-safe:animate-studio-in">
      <div className="flex h-full max-h-full w-full max-w-2xl flex-col overflow-hidden">
        {goalEditorOpen ? (
          <GoalEditor
            draft={goalEditorDraft}
            polishing={goalPolishing}
            onDraftChange={updateGoalEditorDraft}
            onCancel={cancelGoalEditor}
            onPolish={handlePolishGoal}
            onSave={saveGoalEditor}
          />
        ) : (
          <>
            <ScrollFade
              className="min-h-0 flex-1"
              viewportClassName={PANE_RHYTHM.body}
              fadeSize={24}
            >
              <NewSessionForm
                workspaceId={workspaceId}
                isSimple={isSimple}
                noProviderConnected={noProviderConnected}
                onOpenSettings={onOpenSettings}
                issueSources={issueSources}
                issue={issue}
                onPickIssue={onPickIssue}
                onClearIssue={() => setNewSessionDraft({ workspaceId, draft: { issue: null } })}
                goal={goal}
                onGoalChange={(value) =>
                  setNewSessionDraft({ workspaceId, draft: { goal: value } })
                }
                onOpenGoalEditor={openGoalEditor}
                goalEditorDirty={goalEditorDirty}
                attachments={attachments}
                isDragging={isDragging}
                composerRef={composerRef}
                fileInputRef={fileInputRef}
                onFileInputChange={onFileInputChange}
                onRemoveAttachment={removeAttachment}
                branchMode={branchMode}
                onBranchModeChange={(mode) =>
                  setNewSessionDraft({ workspaceId, draft: { branchMode: mode } })
                }
                branchPrefix={sanitizeBranchPrefix({ input: branchPrefix })}
                branchSlug={branchSlug}
                onBranchSlugChange={(value) => {
                  setNewSessionDraft({
                    workspaceId,
                    draft: {
                      branchSlug: sanitizeBranchSlugValue({
                        input: value,
                        maxLength: SLUG_MAX_LEN,
                      }),
                      slugTouched: true,
                    },
                  });
                }}
                folderName={folderName}
                onFolderNameChange={(value) => {
                  setNewSessionDraft({
                    workspaceId,
                    draft: {
                      folderName: value,
                      folderNameTouched: true,
                    },
                  });
                }}
                folderPathPreview={folderPathPreview}
                folderNameError={folderNameError}
                folderConflict={folderConflict.exists}
                folderConflictChecking={folderConflict.checking}
                slugGenerating={slugGenerating}
                onGenerateSlug={handleGenerateSlug}
                existingBranches={existingBranches}
                existingBranch={existingBranch}
                onExistingBranchChange={(value) =>
                  setNewSessionDraft({ workspaceId, draft: { existingBranch: value } })
                }
                branchesLoading={branchesLoading}
                conflictSessionId={conflictSessionId}
                conflictWorktreePath={conflictWorktreePath}
                busy={busy}
              />
            </ScrollFade>
            <NewSessionFooter
              isSimple={isSimple}
              error={error}
              busy={busy}
              onClose={onCancel}
              conflictSessionId={conflictSessionId}
              conflictWorktreePath={conflictWorktreePath}
              goalReady={goalReady}
              canCreate={canCreate}
              onOpenConflictSession={onOpenConflictSession}
              onCreate={onCreate}
            />
          </>
        )}
      </div>
    </div>
  );
};

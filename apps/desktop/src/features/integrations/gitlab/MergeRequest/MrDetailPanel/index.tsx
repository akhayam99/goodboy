import {
  RecordDetailEmptyState,
  RecordDetailHeader,
} from '../../../../../shared/components/StudioDetail';
import { DetailProperties } from '../../../../../shared/components/StudioDetail/DetailProperties';
import { PaneShell } from '../../../../../shared/components/PaneShell';
import { useEffect, useState, type ReactNode } from 'react';
import { Button, ConfirmPopover, Markdown, Notice } from '@goodboy/ui';
import { FileText, GitBranch, GitMerge, MessageSquare } from 'lucide-react';
import type { GitlabIntegrationBinding, SessionId, WorkspaceId } from '@goodboy/types';
import { StudioWidget, StudioDetailTabs } from '@goodboy/ui';
import { gitlabMergeRequestFields, resolveDetailFields } from '../../../../../shared/detail-fields';
import { BranchPair } from '@goodboy/ui';
import { RefreshIconButton } from '@goodboy/ui';
import { useAppStore } from '../../../../../store';
import { useToast } from '../../../../../app/components/Toast';
import {
  gitlabMergeMr,
  gitlabUpdateMrState,
  type GitlabMergeRequest,
  type GitlabMrStateEvent,
} from '../../client';
import { useGitlabMrApprovals } from '../../useGitlabMrApprovals';
import { useGitlabMrDiscussions } from '../../useGitlabMrDiscussions';
import { projectPathFromMrUrl } from '../useGitlabMrs';
import { CreateMrForm } from './CreateMrForm';
import { MrActionBar, type MrActionBusy } from './MrActionBar';
import { MrApprovalRail } from './MrApprovalRail';
import { MrConversation } from './MrConversation';
import { mrDraftTitle } from './mrDraftTitle';
import { gitlabMrStateKind } from '../../gitlabMrStateKind';
import { PullRequestChip } from '../../../../github/components/PullRequestChip';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';

type MrSection = 'overview' | 'conversation';

type Busy = 'merge' | MrActionBusy;

type UpdateParams = {
  readonly kind: Exclude<MrActionBusy, null>;
  readonly toast: string;
  readonly stateEvent?: GitlabMrStateEvent;
  readonly title?: string;
};

type Props = {
  readonly sessionId?: SessionId | null;
  readonly mr?: GitlabMergeRequest | null;
  readonly workspaceId?: WorkspaceId;
  readonly host?: string | null;
  readonly onRefresh?: () => void;
  readonly onClose: () => void;
  readonly headerActions?: ReactNode;
  readonly dock?: ReactNode;
};

const SECTION_OPTIONS = [
  { value: 'overview', label: 'Overview', icon: FileText },
  { value: 'conversation', label: 'Conversation', icon: MessageSquare },
] as const;

export const MrDetailPanel = ({
  sessionId = null,
  mr: selectedMr = null,
  workspaceId,
  host,
  onRefresh,
  onClose,
  headerActions,
  dock,
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
  const mergeMrForSession = useAppStore((s) => s.mergeMrForSession);
  const activeWorkspaceId = workspaceId ?? session?.workspaceId ?? null;
  const integrationHost = useAppStore((s) => {
    if (activeWorkspaceId == null) {
      return null;
    }
    const integration = s.workspaceIntegrations?.[activeWorkspaceId]?.find(
      (candidate): candidate is GitlabIntegrationBinding => candidate.provider === 'gitlab',
    );
    return integration?.config.host ?? null;
  });
  const { showToast } = useToast();
  const reportError = useAppStore((s) => s.reportError);

  const [localMr, setLocalMr] = useState<GitlabMergeRequest | null>(null);
  const [section, setSection] = useState<MrSection>('overview');
  const [busy, setBusy] = useState<Busy>(null);

  const storeMr = mrState?.mr ?? null;
  const mr = localMr ?? selectedMr ?? storeMr;
  const projectPath = mr == null ? null : projectPathFromMrUrl({ webUrl: mr.webUrl });
  const branch = selectedMr?.sourceBranch ?? sessionBranch;
  const loading = mrState?.loading ?? false;
  const error = mrState?.error ?? null;
  const activeHost = host ?? integrationHost;
  const canAct =
    activeWorkspaceId != null && activeHost != null && projectPath != null && mr != null;

  const discussions = useGitlabMrDiscussions({
    workspaceId: canAct ? activeWorkspaceId : null,
    host: canAct ? activeHost : null,
    projectPath: canAct ? projectPath : null,
    mrIid: canAct ? mr.iid : null,
  });
  const approvals = useGitlabMrApprovals({
    workspaceId: canAct ? activeWorkspaceId : null,
    host: canAct ? activeHost : null,
    projectPath: canAct ? projectPath : null,
    mrIid: canAct ? mr.iid : null,
  });

  useEffect(() => {
    if (sessionId == null) {
      return;
    }
    void refreshSessionMr(sessionId, { silent: true });
  }, [sessionId, refreshSessionMr]);

  useEffect(() => {
    setLocalMr(null);
  }, [selectedMr, storeMr]);

  if (sessionId != null && session == null) {
    return (
      <RecordDetailEmptyState
        provider="gitlab"
        title="No session selected"
        description="Pick a session to manage its merge request."
      />
    );
  }

  if (sessionId == null && mr == null) {
    return (
      <RecordDetailEmptyState
        provider="gitlab"
        title="No merge request selected"
        description="Pick a merge request to see its details."
      />
    );
  }

  const onMerge = async () => {
    if (busy !== null) {
      return;
    }
    setBusy('merge');
    try {
      if (sessionId != null) {
        await mergeMrForSession({ sessionId });
      } else if (mr != null && workspaceId != null && host != null && projectPath != null) {
        await gitlabMergeMr(workspaceId, host, projectPath, mr.iid);
        onRefresh?.();
      }
      showToast({ kind: 'success', message: 'Merge request merged' });
      onClose();
    } catch (err) {
      void reportError({
        title: mr == null ? "Couldn't merge the merge request" : `Couldn't merge !${mr.iid}`,
        error: err,
        ...(sessionId != null && { sessionId }),
      });
    } finally {
      setBusy(null);
    }
  };

  const runUpdate = async ({ kind, toast, stateEvent, title }: UpdateParams) => {
    if (busy !== null || mr == null || activeWorkspaceId == null || activeHost == null) {
      return;
    }
    if (projectPath == null) {
      return;
    }
    setBusy(kind);
    try {
      const updated = await gitlabUpdateMrState({
        workspaceId: activeWorkspaceId,
        host: activeHost,
        projectPath,
        mrIid: mr.iid,
        ...(stateEvent !== undefined && { stateEvent }),
        ...(title !== undefined && { title }),
      });
      setLocalMr(updated);
      if (sessionId != null) {
        void refreshSessionMr(sessionId, { force: true });
      }
      onRefresh?.();
      showToast({ kind: 'success', message: toast });
    } catch (err) {
      void reportError({
        title: `Couldn't update !${mr.iid}`,
        error: err,
        ...(sessionId != null && { sessionId }),
      });
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
        discussions.reload();
        if (sessionId != null) {
          void refreshSessionMr(sessionId, { force: true });
          return;
        }
        onRefresh?.();
      }}
    />
  );

  if (mr != null) {
    const actionBusy: MrActionBusy =
      busy === 'draft' || busy === 'close' || busy === 'reopen' ? busy : null;
    const postNote = discussions.post;
    const isMergeBlocked =
      mr.hasConflicts ||
      mr.mergeStatus === 'cannot_be_merged' ||
      (sessionId == null && projectPath == null);

    return (
      <PaneShell
        scroll="body"
        header={
          <>
            <RecordDetailHeader
              provider="gitlab"
              identifier={`!${mr.iid}`}
              title={mr.title}
              badge={<PullRequestChip state={gitlabMrStateKind({ mr })} variant="badge" />}
              subtitle={<BranchPair headBranch={mr.sourceBranch} baseBranch={mr.targetBranch} />}
              actions={
                <>
                  {refreshButton}
                  {mr.state === 'opened' ? (
                    <ConfirmPopover
                      role="danger"
                      icon={<GitMerge size={ICON_SIZE.row} aria-hidden />}
                      title={`Merge !${mr.iid}?`}
                      description="GitLab merges it with the method the project is set to. It cannot be undone from here."
                      confirmLabel={busy === 'merge' ? 'Merging' : 'Confirm merge'}
                      onConfirm={onMerge}
                      isBusy={busy === 'merge'}
                      isConfirmDisabled={isMergeBlocked}
                      trigger={({ isArmed, arm }) => (
                        <Button
                          onClick={arm}
                          aria-expanded={isArmed}
                          disabled={busy !== null || isMergeBlocked}
                          className={busy === 'merge' ? 'animate-border-pulse' : undefined}
                        >
                          {busy === 'merge' ? (
                            'Merging…'
                          ) : (
                            <>
                              <GitMerge size={ICON_SIZE.row} aria-hidden />
                              Merge request
                            </>
                          )}
                        </Button>
                      )}
                    />
                  ) : null}
                  {headerActions}
                </>
              }
              externalRef={{ url: mr.webUrl, label: 'MR' }}
            />
            <MrActionBar
              mr={mr}
              busy={actionBusy}
              approval={approvals.approval}
              isApprovalBusy={approvals.isSubmitting}
              isSupported={approvals.isSupported}
              approvalError={approvals.error}
              canAct={canAct}
              onApprove={approvals.approve == null ? null : () => void approvals.approve?.()}
              onUnapprove={approvals.unapprove == null ? null : () => void approvals.unapprove?.()}
              onToggleDraft={() =>
                void runUpdate({
                  kind: 'draft',
                  toast: mr.draft ? 'Merge request marked ready' : 'Merge request back to draft',
                  title: mrDraftTitle({ title: mr.title, isDraft: !mr.draft }),
                })
              }
              onClose={() =>
                runUpdate({
                  kind: 'close',
                  toast: 'Merge request closed',
                  stateEvent: 'close',
                })
              }
              onReopen={() =>
                void runUpdate({
                  kind: 'reopen',
                  toast: 'Merge request reopened',
                  stateEvent: 'reopen',
                })
              }
            />
          </>
        }
        tabs={
          <StudioDetailTabs
            ariaLabel="Merge request sections"
            options={SECTION_OPTIONS}
            value={section}
            onChange={setSection}
          />
        }
        dock={dock}
      >
        <DetailProperties
          entries={resolveDetailFields({ registry: gitlabMergeRequestFields, entity: mr })}
        />
        <MrApprovalRail
          approval={approvals.approval}
          isLoading={approvals.isLoading}
          error={approvals.error}
        />
        {mr.hasConflicts ? (
          <Notice
            tone="warning"
            placement="inline"
            title="This merge request has conflicts"
            body="Resolve them before merging."
          />
        ) : null}

        {section === 'overview' ? (
          <StudioWidget presentation="section" label="description" variant="frameless">
            {mr.description != null && mr.description !== '' ? (
              <Markdown text={mr.description} className="text-sm leading-relaxed" />
            ) : (
              <p className="text-sm italic text-faint-foreground">No description.</p>
            )}
          </StudioWidget>
        ) : (
          <MrConversation
            discussions={discussions.discussions}
            isLoading={discussions.isLoading}
            error={discussions.error}
            onRetry={discussions.reload}
            onPost={postNote == null ? null : (body: string) => postNote({ body })}
            onReply={discussions.reply}
            onResolve={discussions.resolve}
            resolveError={discussions.resolveError}
          />
        )}
      </PaneShell>
    );
  }

  return (
    <PaneShell
      scroll="self"
      title="New merge request"
      meta={
        <span className="inline-flex items-center gap-1.5 font-mono">
          <GitBranch size={11} aria-hidden />
          {branch ?? 'no branch'}
        </span>
      }
      actions={refreshButton}
    >
      {sessionId != null && (
        <CreateMrForm sessionId={sessionId} branch={branch} error={error} onClose={onClose} />
      )}
    </PaneShell>
  );
};

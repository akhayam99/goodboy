import { RecordDetailEmptyState } from '../../../../../shared/components/StudioDetail';
import { RecordHeader } from '../../../../../shared/components/StudioDetail/RecordHeader';
import type { RecordFrame } from '../../../../../shared/components/StudioDetail/RecordActions/types';
import { DetailProperties } from '../../../../../shared/components/StudioDetail/DetailProperties';
import { PaneShell } from '../../../../../shared/components/PaneShell';
import { useEffect, useState } from 'react';
import { Markdown, Notice } from '@goodboy/ui';
import { FileText, GitBranch, MessageSquare } from 'lucide-react';
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
import { MrApprovalRail } from './MrApprovalRail';
import { MrConversation } from './MrConversation';
import { mrDraftTitle } from './mrDraftTitle';
import { gitlabMrStateKind } from '../../gitlabMrStateKind';
import { PullRequestChip } from '../../../../github/components/PullRequestChip';
import { useMrVerbs, type MrVerbBusy } from './useMrVerbs';

type MrSection = 'overview' | 'conversation';

type UpdateParams = {
  readonly kind: Exclude<MrVerbBusy, 'merge' | null>;
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
  readonly frame?: RecordFrame | null;
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
  frame = null,
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
  const [busy, setBusy] = useState<MrVerbBusy>(null);

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

  const refresh = () => {
    discussions.reload();
    if (sessionId != null) {
      void refreshSessionMr(sessionId, { force: true });
      return;
    }
    onRefresh?.();
  };

  const verbs = useMrVerbs({
    mr,
    busy,
    approval: approvals.approval,
    isApprovalBusy: approvals.isSubmitting,
    isSupported: approvals.isSupported,
    approvalError: approvals.error,
    canAct,
    canMerge: sessionId != null || projectPath != null,
    onMerge,
    onApprove: approvals.approve == null ? null : () => void approvals.approve?.(),
    onUnapprove: approvals.unapprove == null ? null : () => void approvals.unapprove?.(),
    onToggleDraft: () => {
      if (mr == null) {
        return;
      }
      void runUpdate({
        kind: 'draft',
        toast: mr.draft ? 'Merge request marked ready' : 'Merge request back to draft',
        title: mrDraftTitle({ title: mr.title, isDraft: !mr.draft }),
      });
    },
    onClose: () => runUpdate({ kind: 'close', toast: 'Merge request closed', stateEvent: 'close' }),
    onReopen: () =>
      void runUpdate({ kind: 'reopen', toast: 'Merge request reopened', stateEvent: 'reopen' }),
  });

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

  if (mr != null) {
    const postNote = discussions.post;

    return (
      <PaneShell
        scroll="body"
        header={
          <RecordHeader
            provider="gitlab"
            identifier={`!${mr.iid}`}
            title={mr.title}
            state={<PullRequestChip state={gitlabMrStateKind({ mr })} variant="badge" />}
            facts={<BranchPair headBranch={mr.sourceBranch} baseBranch={mr.targetBranch} />}
            externalRef={{ url: mr.webUrl, label: 'MR' }}
            verbs={verbs}
            frame={frame}
            onRefresh={refresh}
          />
        }
        tabs={
          <StudioDetailTabs
            ariaLabel="Merge request sections"
            options={SECTION_OPTIONS}
            value={section}
            onChange={setSection}
          />
        }
      >
        {error != null ? (
          <Notice
            tone="warning"
            placement="inline"
            title="Couldn't refresh this merge request"
            body={error}
          />
        ) : null}
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
      actions={
        <RefreshIconButton
          label="refresh merge request"
          iconSize={12}
          isLoading={loading}
          error={error}
          onClick={refresh}
        />
      }
    >
      {sessionId != null && (
        <CreateMrForm sessionId={sessionId} branch={branch} error={error} onClose={onClose} />
      )}
    </PaneShell>
  );
};

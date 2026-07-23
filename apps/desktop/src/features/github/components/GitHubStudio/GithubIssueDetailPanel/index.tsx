import { useEffect, useState } from 'react';
import { Button, Divider, EmptyState, Input, Markdown, SectionHeader, Textarea } from '@goodboy/ui';
import {
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  GitBranch,
  MessagesSquare,
  MousePointerClick,
} from 'lucide-react';
import type { GithubIssue, SessionId, WorkspaceId } from '@goodboy/types';
import { useToast } from '../../../../../app/components/Toast';
import { OpenSessionButton } from '../../../../../shared/components/OpenSessionButton';
import { BaseBranchGuide } from '../../../../../shared/components/BaseBranchGuide';
import {
  DetailSection,
  HeaderBand,
  MetaItem,
  StudioDetailLayout,
} from '../../../../../shared/components/StudioDetail';
import { formatRelativeDuration } from '../../../../../shared/utils/relativeDate';
import { formatError, isMissingBaseRefError } from '../../../../../shared/lib/errors';
import { isValidBranchSlug } from '../../../../../shared/utils/isValidBranchSlug';
import { sanitizeBranchPrefix } from '../../../../../shared/utils/sanitizeBranchPrefix';
import { sanitizeBranchSlug } from '../../../../../shared/utils/sanitizeBranchSlug';
import { useAppStore } from '../../../../../store';
import { DEFAULT_BRANCH_PREFIX, settingBranchPrefix } from '../../../../settings/settings';
import { removeWorktree } from '../../../../worktree/worktree';
import { useBranchConflict } from '../../../../worktree/useBranchConflict';
import { goalFromIssue } from '../../../goal-from-issue';
import { githubBranchSlug } from '../useGithubIssues';

type Props = {
  readonly issue: GithubIssue | null;
  readonly sessionId: SessionId | null;
  readonly workspaceId: WorkspaceId;
  readonly onClose: () => void;
};

type LaunchParams = {
  readonly eraseWorktreePath?: string;
};

export const GithubIssueDetailPanel = ({ issue, sessionId, workspaceId, onClose }: Props) => {
  const createSession = useAppStore((state) => state.createSession);
  const loadSetting = useAppStore((state) => state.loadSetting);
  const rootPath = useAppStore(
    (state) => state.workspaces.find((workspace) => workspace.id === workspaceId)?.rootPath ?? null,
  );
  const { showToast } = useToast();
  const [goal, setGoal] = useState('');
  const [branchSlug, setBranchSlug] = useState('');
  const [branchPrefix, setBranchPrefix] = useState(DEFAULT_BRANCH_PREFIX);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prefix = sanitizeBranchPrefix({ input: branchPrefix }) || DEFAULT_BRANCH_PREFIX;
  const isBranchValid = isValidBranchSlug({ slug: branchSlug });
  const fullBranch = isBranchValid ? `${prefix}/${branchSlug.trim()}` : null;
  const conflict = useBranchConflict(fullBranch, rootPath);
  const branchSessionId = conflict?.kind === 'session' ? conflict.sessionId : null;
  const conflictPath = conflict?.kind === 'worktree' ? conflict.path : null;

  useEffect(() => {
    if (issue == null) {
      return;
    }
    setGoal(goalFromIssue({ issue }));
    setBranchSlug(githubBranchSlug({ issue }));
    setError(null);
    setBusy(false);
  }, [issue]);

  useEffect(() => {
    void loadSetting(settingBranchPrefix(workspaceId)).then((value) => {
      setBranchPrefix(value ?? DEFAULT_BRANCH_PREFIX);
    });
  }, [loadSetting, workspaceId]);

  if (issue == null) {
    return (
      <div className="flex h-full items-center justify-center px-8">
        <EmptyState
          icon={MousePointerClick}
          title="No issue selected"
          description="Pick an issue to see its details and launch a session."
        />
      </div>
    );
  }

  const openableSessionId = sessionId ?? branchSessionId;
  const isMissingBase = error != null && isMissingBaseRefError(error);
  const isBlockedByConflict = conflictPath != null;
  const canLaunch = goal.trim() !== '' && isBranchValid && !busy && !isBlockedByConflict;

  const launch = async ({ eraseWorktreePath }: LaunchParams) => {
    setError(null);
    setBusy(true);
    try {
      if (eraseWorktreePath != null && rootPath != null) {
        await removeWorktree(rootPath, eraseWorktreePath);
      }
      const { session } = await createSession({
        workspaceId,
        goal,
        branchPrefix: prefix,
        branchSlug: branchSlug.trim() || undefined,
        externalTask: {
          provider: 'github',
          externalId: String(issue.number),
          identifier: `#${issue.number}`,
          url: issue.url,
          title: issue.title,
        },
      });
      showToast('success', `Session created: ${session.goal}`);
      onClose();
    } catch (launchError) {
      setError(formatError(launchError));
    } finally {
      setBusy(false);
    }
  };

  const updated = formatRelativeDuration(issue.updatedAt);

  const launchCard = (
    <section className="flex flex-col gap-3">
      <SectionHeader label="launch session" />
      {openableSessionId != null ? (
        <div className="flex items-center gap-3 rounded-lg border border-border-soft bg-muted/10 px-4 py-3.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-success/15">
            <MessagesSquare size={15} className="text-success" aria-hidden />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-medium text-foreground">Session already launched</span>
            <span className="truncate text-2xs text-muted-foreground">
              {sessionId != null
                ? 'A session is linked to this issue.'
                : 'A session is already on this branch.'}
            </span>
          </div>
          <OpenSessionButton sessionId={openableSessionId} onOpened={onClose} />
        </div>
      ) : (
        <div className="flex flex-col gap-4 rounded-lg border border-border-soft bg-muted/10 p-4">
          <div className="flex flex-col gap-1.5">
            <SectionHeader label="Goal" />
            <Textarea
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              autoGrow
              minRows={3}
              maxRows={10}
              disabled={busy}
              aria-label="Session goal"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <SectionHeader
              label="Branch"
              icon={<GitBranch size={13} aria-hidden className="text-success" />}
            />
            <div className="flex items-center gap-1.5">
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {prefix + '/'}
              </span>
              <Input
                value={branchSlug}
                onChange={(event) =>
                  setBranchSlug(sanitizeBranchSlug({ input: event.target.value, maxLength: 48 }))
                }
                placeholder="branch-slug"
                className="h-8 flex-1 font-mono text-sm"
                disabled={busy}
                aria-label="Branch slug"
              />
            </div>
            {conflictPath != null ? (
              <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-2.5 py-2 text-2xs leading-relaxed text-foreground">
                <AlertTriangle size={12} aria-hidden className="shrink-0 text-warning" />
                <span>This branch is already checked out in another worktree.</span>
              </div>
            ) : null}
          </div>
          {isMissingBase ? <BaseBranchGuide /> : null}
          <div className="flex items-center gap-3">
            {error != null && !isMissingBase ? (
              <span className="text-xs text-danger">{error}</span>
            ) : null}
            <span className="flex-1" />
            <Button
              variant={isBlockedByConflict ? 'danger' : undefined}
              onClick={() => void launch({ eraseWorktreePath: conflictPath ?? undefined })}
              disabled={isBlockedByConflict ? busy || goal.trim() === '' : !canLaunch}
            >
              {busy
                ? 'Launching…'
                : isBlockedByConflict
                  ? 'Erase worktree & launch'
                  : 'Launch session'}
              {!busy ? <ArrowRight size={13} aria-hidden /> : null}
            </Button>
          </div>
        </div>
      )}
    </section>
  );

  return (
    <StudioDetailLayout
      header={
        <HeaderBand
          meta={
            <>
              <span className="font-mono text-2xs tabular-nums text-muted-foreground">
                #{issue.number}
              </span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-2xs font-medium text-muted-foreground">
                {issue.state.toLowerCase()}
              </span>
            </>
          }
          title={issue.title}
          actions={
            <a
              href={issue.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-2xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Open in GitHub <ExternalLink size={11} aria-hidden />
            </a>
          }
        />
      }
      rail={
        <>
          {launchCard}
          <Divider />
          {issue.labels.length > 0 ? (
            <MetaItem label="Labels">
              {issue.labels.map((label) => (
                <span
                  key={label}
                  className="rounded bg-muted px-1.5 py-0.5 text-2xs font-medium text-muted-foreground"
                >
                  {label}
                </span>
              ))}
            </MetaItem>
          ) : null}
          {updated !== '' ? <MetaItem label="Updated">{updated} ago</MetaItem> : null}
        </>
      }
    >
      <DetailSection label="description">
        {issue.body.trim() !== '' ? (
          <Markdown text={issue.body} className="text-sm leading-relaxed" />
        ) : (
          <p className="text-sm italic text-muted-foreground/60">No description.</p>
        )}
      </DetailSection>
    </StudioDetailLayout>
  );
};

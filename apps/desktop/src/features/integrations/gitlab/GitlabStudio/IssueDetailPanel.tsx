import { useEffect, useState } from 'react';
import { Button, Divider, EmptyState, Input, Markdown, SectionHeader, Textarea } from '@goodboy/ui';
import {
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  GitBranch,
  MessagesSquare,
  Milestone,
  MousePointerClick,
  Target,
} from 'lucide-react';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { OpenSessionButton } from '../../../../shared/components/OpenSessionButton';
import {
  DetailSection,
  HeaderBand,
  MetaItem,
  StudioDetailLayout,
} from '../../../../shared/components/StudioDetail';
import { formatRelativeDuration } from '../../../../shared/utils/relativeDate';
import { useAppStore } from '../../../../store';
import { useToast } from '../../../../app/components/Toast';
import { formatError, isMissingBaseRefError } from '../../../../shared/lib/errors';
import { BaseBranchGuide } from '../../../../shared/components/BaseBranchGuide';
import { isValidBranchSlug as validateBranchSlug } from '../../../../shared/utils/isValidBranchSlug';
import { sanitizeBranchPrefix } from '../../../../shared/utils/sanitizeBranchPrefix';
import { sanitizeBranchSlug } from '../../../../shared/utils/sanitizeBranchSlug';
import { DEFAULT_BRANCH_PREFIX, settingBranchPrefix } from '../../../settings/settings';
import { removeWorktree } from '../../../worktree/worktree';
import { useBranchConflict } from '../../../worktree/useBranchConflict';
import { goalFromIssue } from '../goal-from-issue';
import { issueIdentifier, type GitlabIssue } from '../client';
import { gitlabBranchSlug } from './useGitlabIssues';

type Props = {
  readonly issue: GitlabIssue | null;
  readonly sessionId: SessionId | null;
  readonly workspaceId: WorkspaceId;
  readonly onClose: () => void;
};

const SLUG_MAX_LEN = 48;

const sanitizeSlug = (input: string): string =>
  sanitizeBranchSlug({ input, maxLength: SLUG_MAX_LEN });

const sanitizePrefix = (input: string): string => sanitizeBranchPrefix({ input });

const isValidBranchSlug = (slug: string): boolean => validateBranchSlug({ slug });

export const IssueDetailPanel = ({ issue, sessionId, workspaceId, onClose }: Props) => {
  const createSession = useAppStore((s) => s.createSession);
  const loadSetting = useAppStore((s) => s.loadSetting);
  const rootPath = useAppStore(
    (s) => s.workspaces.find((w) => w.id === workspaceId)?.rootPath ?? null,
  );
  const { showToast } = useToast();

  const [goal, setGoal] = useState('');
  const [branchSlug, setBranchSlug] = useState('');
  const [branchPrefix, setBranchPrefix] = useState(DEFAULT_BRANCH_PREFIX);
  const [setupWorkflow, setSetupWorkflow] = useState(() => {
    try {
      return localStorage.getItem('goodboy:new-session-setup-workflow') !== '0';
    } catch {
      return true;
    }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prefix = sanitizePrefix(branchPrefix) || DEFAULT_BRANCH_PREFIX;
  const branchValid = isValidBranchSlug(branchSlug);
  const fullBranch = branchValid ? `${prefix}/${branchSlug.trim()}` : null;
  const conflict = useBranchConflict(fullBranch, rootPath);
  const branchSessionId = conflict?.kind === 'session' ? conflict.sessionId : null;
  const conflictPath = conflict?.kind === 'worktree' ? conflict.path : null;

  useEffect(() => {
    if (!issue) {
      return;
    }
    setGoal(goalFromIssue(issue));
    setBranchSlug(gitlabBranchSlug(issue));
    setError(null);
    setBusy(false);
  }, [issue]);

  useEffect(() => {
    void loadSetting(settingBranchPrefix(workspaceId)).then((value) => {
      setBranchPrefix(value ?? DEFAULT_BRANCH_PREFIX);
    });
  }, [workspaceId, loadSetting]);

  if (!issue) {
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
  const missingBase = error !== null && isMissingBaseRefError(error);
  const blockedByConflict = conflictPath !== null;
  const canLaunch = goal.trim().length > 0 && branchValid && !busy && !blockedByConflict;

  const onLaunch = async (eraseWorktreePath?: string) => {
    setError(null);
    setBusy(true);
    try {
      if (eraseWorktreePath && rootPath) await removeWorktree(rootPath, eraseWorktreePath);
      const { session } = await createSession({
        workspaceId,
        goal,
        branchPrefix: prefix,
        branchSlug: branchSlug.trim() || undefined,
        externalTask: {
          provider: 'gitlab',
          externalId: String(issue.id),
          identifier: issueIdentifier(issue),
          url: issue.webUrl,
          title: issue.title,
        },
      });
      showToast('success', `Session created: ${session.goal}`);
      onClose();
      if (setupWorkflow) {
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent('goodboy:open-workflow-builder', {
              detail: { sessionId: session.id },
            }),
          );
        }, 0);
      }
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  const onToggleSetupWorkflow = (next: boolean) => {
    setSetupWorkflow(next);
    try {
      localStorage.setItem('goodboy:new-session-setup-workflow', next ? '1' : '0');
    } catch {
      void 0;
    }
  };

  const updated = formatRelativeDuration(issue.updatedAt);

  const launch = (
    <section className="flex flex-col gap-3">
      <SectionHeader label="launch session" />
      {openableSessionId ? (
        <div className="flex items-center gap-3 rounded-lg border border-border-soft bg-muted/10 px-4 py-3.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-success/15">
            <MessagesSquare size={15} className="text-success" aria-hidden />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-medium text-foreground">Session already launched</span>
            <span className="truncate text-2xs text-muted-foreground">
              {sessionId
                ? 'A session is linked to this issue.'
                : 'A session is already on this branch.'}
            </span>
          </div>
          <OpenSessionButton sessionId={openableSessionId} onOpened={onClose} />
        </div>
      ) : (
        <div className="flex flex-col gap-4 rounded-lg border border-border-soft bg-muted/10 p-4">
          <LaunchField
            icon={<Target size={13} aria-hidden className="text-primary" />}
            label="Goal"
          >
            <Textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              autoGrow
              minRows={3}
              maxRows={10}
              disabled={busy}
              aria-label="Session goal"
            />
          </LaunchField>

          <LaunchField
            icon={<GitBranch size={13} aria-hidden className="text-success" />}
            label="Branch"
          >
            <div className="flex items-center gap-1.5">
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {prefix + '/'}
              </span>
              <Input
                value={branchSlug}
                onChange={(e) => setBranchSlug(sanitizeSlug(e.target.value))}
                placeholder="branch-slug"
                className="h-8 flex-1 font-mono text-sm"
                disabled={busy}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                aria-label="Branch slug"
              />
            </div>
            {conflictPath ? (
              <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-2.5 py-2 text-2xs leading-relaxed text-foreground">
                <AlertTriangle size={12} aria-hidden className="mt-0.5 shrink-0 text-warning" />
                <span>
                  This branch is already checked out in another worktree (
                  <span className="break-all font-mono">{conflictPath}</span>). Launching erases
                  that worktree and recreates it here. Pick a different slug to keep it.
                </span>
              </div>
            ) : null}
          </LaunchField>

          {missingBase ? <BaseBranchGuide /> : null}

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={setupWorkflow}
                onChange={(e) => onToggleSetupWorkflow(e.target.checked)}
                className="accent-primary"
                disabled={busy}
              />
              Set up workflow next
            </label>
            <span className="flex-1" />
            {error && !missingBase ? <span className="text-xs text-danger">{error}</span> : null}
            {blockedByConflict ? (
              <Button
                variant="danger"
                onClick={() => void onLaunch(conflictPath ?? undefined)}
                disabled={busy || goal.trim().length === 0}
                className={busy ? 'animate-border-pulse' : undefined}
              >
                {busy ? (
                  'Working…'
                ) : (
                  <>
                    Erase worktree &amp; launch
                    <ArrowRight size={13} className="ml-1.5" aria-hidden />
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={() => void onLaunch()}
                disabled={!canLaunch}
                className={busy ? 'animate-border-pulse' : undefined}
              >
                {busy ? (
                  'Launching…'
                ) : (
                  <>
                    Launch session
                    <ArrowRight size={13} className="ml-1.5" aria-hidden />
                  </>
                )}
              </Button>
            )}
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
                {issueIdentifier(issue)}
              </span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-2xs font-medium text-muted-foreground">
                {issue.state}
              </span>
            </>
          }
          title={issue.title}
          actions={
            <a
              href={issue.webUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-2xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Open in GitLab <ExternalLink size={11} aria-hidden />
            </a>
          }
        />
      }
      rail={
        <>
          {launch}
          <Divider />
          {issue.milestone ? (
            <MetaItem label="Milestone">
              <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-2xs font-medium text-primary">
                <Milestone size={10} aria-hidden />
                {issue.milestone.title}
              </span>
            </MetaItem>
          ) : null}
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
        {issue.description ? (
          <Markdown text={issue.description} className="text-sm leading-relaxed" />
        ) : (
          <p className="text-sm italic text-muted-foreground/60">No description.</p>
        )}
      </DetailSection>
    </StudioDetailLayout>
  );
};

function LaunchField({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <SectionHeader label={label} icon={icon} />
      {children}
    </div>
  );
}

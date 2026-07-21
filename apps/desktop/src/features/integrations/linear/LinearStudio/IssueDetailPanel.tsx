import { useEffect, useState } from 'react';
import {
  Button,
  Divider,
  EmptyState,
  Input,
  Markdown,
  SectionHeader,
  StatusDot,
  Textarea,
  cn,
} from '@goodboy/ui';
import {
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  GitBranch,
  GitPullRequest,
  MessagesSquare,
  MousePointerClick,
  Target,
} from 'lucide-react';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { ScrollFade } from '@goodboy/ui';
import { OpenSessionButton } from '../../../../shared/components/OpenSessionButton';
import { useAppStore } from '../../../../store';
import { useToast } from '../../../../app/components/Toast';
import { formatError, isMissingBaseRefError } from '../../../../shared/lib/errors';
import { BaseBranchGuide } from '../../../../shared/components/BaseBranchGuide';
import { isValidBranchSlug as validateBranchSlug } from '../../../../shared/utils/isValidBranchSlug';
import { sanitizeBranchPrefix } from '../../../../shared/utils/sanitizeBranchPrefix';
import { sanitizeBranchSlug } from '../../../../shared/utils/sanitizeBranchSlug';
import { slugifyBranch } from '../../../../shared/utils/slugifyBranch';
import { DEFAULT_BRANCH_PREFIX, settingBranchPrefix } from '../../../settings/settings';
import { removeWorktree } from '../../../worktree/worktree';
import { useBranchConflict } from '../../../worktree/useBranchConflict';
import { ghPrHeadBranch } from '../../../github/github';
import { goalFromIssue } from '../goal-from-issue';
import { issuePullRequests, type LinearIssue } from '../client';

type BranchMode = 'pr' | 'fresh';

type Props = {
  readonly issue: LinearIssue | null;
  readonly sessionId: SessionId | null;
  readonly workspaceId: WorkspaceId;
  readonly onClose: () => void;
};

const SLUG_MAX_LEN = 48;

const slugify = (input: string): string => slugifyBranch({ input, maxLength: SLUG_MAX_LEN });

const sanitizeSlug = (input: string): string =>
  sanitizeBranchSlug({ input, maxLength: SLUG_MAX_LEN });

const sanitizePrefix = (input: string): string => sanitizeBranchPrefix({ input });

const isValidBranchSlug = (slug: string): boolean => validateBranchSlug({ slug });

function branchSlugFor(issue: LinearIssue): string {
  const branchName = issue.branchName;
  if (branchName) {
    const idx = branchName.indexOf('/');
    const tail = idx >= 0 ? branchName.slice(idx + 1) : branchName;
    const cleaned = sanitizeSlug(tail);
    if (cleaned.length > 0) {
      return cleaned;
    }
  }
  return slugify(issue.title);
}

function prStatusTone(status: string | null): string {
  switch (status?.toLowerCase()) {
    case 'merged':
      return 'border-primary/40 bg-primary/10 text-primary';
    case 'open':
      return 'border-success/40 bg-success/10 text-success';
    case 'draft':
      return 'border-border-soft bg-muted/50 text-muted-foreground';
    case 'closed':
      return 'border-danger/40 bg-danger/10 text-danger';
    default:
      return 'border-border-soft bg-muted/40 text-muted-foreground';
  }
}

export const IssueDetailPanel = ({ issue, sessionId, workspaceId, onClose }: Props) => {
  const createSession = useAppStore((s) => s.createSession);
  const loadSetting = useAppStore((s) => s.loadSetting);
  const rootPath = useAppStore(
    (s) => s.workspaces.find((w) => w.id === workspaceId)?.rootPath ?? null,
  );
  const { showToast } = useToast();

  const adoptablePr = issue ? (issuePullRequests(issue).find((pr) => pr.repo) ?? null) : null;

  const [goal, setGoal] = useState('');
  const [branchSlug, setBranchSlug] = useState('');
  const [branchPrefix, setBranchPrefix] = useState(DEFAULT_BRANCH_PREFIX);
  const [mode, setMode] = useState<BranchMode>('fresh');
  const [prBranch, setPrBranch] = useState<string | null>(null);
  const [prResolving, setPrResolving] = useState(false);
  const [prError, setPrError] = useState<string | null>(null);
  const [setupWorkflow, setSetupWorkflow] = useState(() => {
    try {
      return localStorage.getItem('goodboy:new-session-setup-workflow') !== '0';
    } catch {
      return true;
    }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const conflict = useBranchConflict(mode === 'pr' ? prBranch : null, rootPath);
  const branchSessionId = conflict?.kind === 'session' ? conflict.sessionId : null;
  const conflictPath = conflict?.kind === 'worktree' ? conflict.path : null;

  useEffect(() => {
    if (!issue) {
      return;
    }
    setGoal(goalFromIssue(issue));
    setBranchSlug(branchSlugFor(issue));
    setError(null);
    setBusy(false);
    setMode(issuePullRequests(issue).some((pr) => pr.repo) ? 'pr' : 'fresh');
    setPrBranch(null);
    setPrError(null);
  }, [issue]);

  useEffect(() => {
    void loadSetting(settingBranchPrefix(workspaceId)).then((value) => {
      setBranchPrefix(value ?? DEFAULT_BRANCH_PREFIX);
    });
  }, [workspaceId, loadSetting]);

  useEffect(() => {
    if (mode !== 'pr' || !adoptablePr?.repo || !rootPath) {
      return;
    }
    const prNumber = adoptablePr.number;
    let cancelled = false;
    setPrResolving(true);
    setPrError(null);
    ghPrHeadBranch(rootPath, prNumber, workspaceId)
      .then((branch) => {
        if (!cancelled) {
          setPrBranch(branch);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPrError(formatError(err));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPrResolving(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [mode, adoptablePr?.repo, adoptablePr?.number, rootPath]);

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

  const branchReady =
    mode === 'pr' ? Boolean(prBranch) && !prResolving : isValidBranchSlug(branchSlug);
  const missingBase = error !== null && isMissingBaseRefError(error);
  const blockedByConflict = mode === 'pr' && conflictPath !== null;
  const canLaunch = goal.trim().length > 0 && branchReady && !busy && !blockedByConflict;

  const onLaunch = async (eraseWorktreePath?: string) => {
    setError(null);
    setBusy(true);
    try {
      if (eraseWorktreePath && rootPath) {
        await removeWorktree(rootPath, eraseWorktreePath);
      }
      const adoptBranch = mode === 'pr' ? (prBranch ?? undefined) : undefined;
      const { session } = await createSession({
        workspaceId,
        goal,
        branchPrefix: sanitizePrefix(branchPrefix).trim() || DEFAULT_BRANCH_PREFIX,
        branchSlug: branchSlug.trim() || undefined,
        ...(adoptBranch ? { existingBranch: adoptBranch } : {}),
        externalTask: {
          provider: 'linear',
          externalId: issue.id,
          identifier: issue.identifier,
          url: issue.url,
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

  const linkedPrs = issuePullRequests(issue);

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-col gap-2 px-8 py-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-2xs tabular-nums text-muted-foreground">
            {issue.identifier}
          </span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-2xs font-medium text-muted-foreground">
            {issue.state.name}
          </span>
          <span className="flex-1" />
          <a
            href={issue.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-2xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Open in Linear <ExternalLink size={11} aria-hidden />
          </a>
        </div>
        <h2 className="text-lg font-semibold leading-snug text-foreground">{issue.title}</h2>
        {linkedPrs.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {linkedPrs.map((pr) => (
              <a
                key={pr.number}
                href={pr.url}
                target="_blank"
                rel="noreferrer"
                title={pr.url}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-2xs font-medium transition-opacity hover:opacity-80',
                  prStatusTone(pr.status),
                )}
              >
                <GitPullRequest size={11} aria-hidden />#{pr.number}
                {pr.status ? <span className="opacity-70">· {pr.status}</span> : null}
              </a>
            ))}
          </div>
        )}
      </div>
      <Divider />

      <div className="min-h-0 flex-1">
        <ScrollFade
          className="mx-auto h-full max-w-3xl"
          viewportClassName="px-10 py-8"
          fadeSize={24}
        >
          <div className="flex flex-col gap-8">
            <section className="flex flex-col gap-3">
              <SectionHeader label="description" />
              {issue.description ? (
                <Markdown text={issue.description} className="text-sm leading-relaxed" />
              ) : (
                <p className="text-sm italic text-muted-foreground/60">No description.</p>
              )}
            </section>

            <section className="flex flex-col gap-3">
              <SectionHeader label="launch session" />
              {openableSessionId ? (
                <div className="flex items-center gap-3 rounded-lg border border-border-soft bg-muted/10 px-4 py-3.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-success/15">
                    <MessagesSquare size={15} className="text-success" aria-hidden />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-medium text-foreground">
                      Session already launched
                    </span>
                    <span className="truncate text-2xs text-muted-foreground">
                      {sessionId
                        ? 'A session is linked to this issue.'
                        : 'A session is already on this PR branch.'}
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
                    {adoptablePr ? (
                      <div
                        role="tablist"
                        aria-label="branch source"
                        className="mb-2 inline-flex rounded-md border border-border bg-background p-0.5 text-2xs"
                      >
                        <BranchModeButton
                          active={mode === 'pr'}
                          disabled={busy}
                          onClick={() => setMode('pr')}
                          label={`Continue on PR #${adoptablePr.number}`}
                        />
                        <BranchModeButton
                          active={mode === 'fresh'}
                          disabled={busy}
                          onClick={() => setMode('fresh')}
                          label="Start fresh"
                        />
                      </div>
                    ) : null}

                    {mode === 'pr' && adoptablePr ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex h-9 items-center gap-2 rounded-md border border-border bg-subtle/40 px-2.5 font-mono text-sm">
                          <GitPullRequest
                            size={13}
                            aria-hidden
                            className="shrink-0 text-muted-foreground"
                          />
                          {prResolving ? (
                            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                              <StatusDot tone="info" size="sm" pulsing /> resolving…
                            </span>
                          ) : prBranch ? (
                            <span className="truncate text-foreground">{prBranch}</span>
                          ) : (
                            <span className="truncate text-danger">
                              {prError ?? 'No branch found'}
                            </span>
                          )}
                        </div>
                        <span className="text-2xs leading-relaxed text-muted-foreground/70">
                          Adopts the branch of PR #{adoptablePr.number}: the existing PR links to
                          this session instead of starting a duplicate.
                        </span>
                        {conflictPath ? (
                          <div className="mt-1 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-2.5 py-2 text-2xs leading-relaxed text-foreground">
                            <AlertTriangle
                              size={12}
                              aria-hidden
                              className="mt-0.5 shrink-0 text-warning"
                            />
                            <span>
                              This branch is already checked out in another worktree (
                              <span className="break-all font-mono">{conflictPath}</span>).
                              Launching erases that worktree and recreates it here. Pick Start fresh
                              to keep it and branch off main instead.
                            </span>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="shrink-0 font-mono text-xs text-muted-foreground">
                          {(sanitizePrefix(branchPrefix) || DEFAULT_BRANCH_PREFIX) + '/'}
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
                    )}
                  </LaunchField>

                  {missingBase ? <BaseBranchGuide /> : null}

                  <div className="flex items-center gap-3 pt-1">
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
                    {error && !missingBase ? (
                      <span className="text-xs text-danger">{error}</span>
                    ) : null}
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
          </div>
        </ScrollFade>
      </div>
    </div>
  );
};

function BranchModeButton({
  active,
  disabled,
  onClick,
  label,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded px-2 py-1 font-medium transition-colors',
        active
          ? 'bg-muted text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      {label}
    </button>
  );
}

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

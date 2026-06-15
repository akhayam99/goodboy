import { useEffect, useRef, useState } from 'react';
import { Button, Divider, EmptyState, Input, SectionHeader, Textarea, cn } from '@goodboy/ui';
import {
  ArrowRight,
  ExternalLink,
  GitBranch,
  Layers,
  Loader2,
  MessagesSquare,
  MousePointerClick,
  Target,
} from 'lucide-react';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { ScrollFade } from '../../../../shared/components/ScrollFade';
import { OpenSessionButton } from '../../../../shared/components/OpenSessionButton';
import { useAppStore } from '../../../../store';
import { useToast } from '../../../../app/components/Toast';
import { formatError, isMissingBaseRefError } from '../../../../shared/lib/errors';
import { BaseBranchGuide } from '../../../../shared/components/BaseBranchGuide';
import { DEFAULT_BRANCH_PREFIX, settingBranchPrefix } from '../../../settings/settings';
import { goalFromSentry } from '../goal-from-sentry';
import { sentryFetchIssueDetail, type SentryIssue, type SentryIssueDetail } from '../client';

type Props = {
  readonly issue: SentryIssue | null;
  readonly sessionId: SessionId | null;
  readonly workspaceId: WorkspaceId;
  readonly onClose: () => void;
};

const SLUG_MAX_LEN = 30;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, SLUG_MAX_LEN)
    .replace(/-+$/, '');
}

function sanitizeSlug(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/, '')
    .slice(0, SLUG_MAX_LEN);
}

function sanitizePrefix(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '')
    .replace(/^-+/, '')
    .slice(0, 16);
}

function isValidBranchSlug(slug: string): boolean {
  const s = slug.trim();
  if (!s) {
    return false;
  }
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(s) && !s.includes('..');
}

const LEVEL_TONE: Record<string, string> = {
  fatal: 'border-danger/40 bg-danger/10 text-danger',
  error: 'border-danger/40 bg-danger/10 text-danger',
  warning: 'border-warning/40 bg-warning/10 text-warning',
  info: 'border-info/40 bg-info/10 text-info',
  debug: 'border-border-soft bg-muted/40 text-muted-foreground',
};

const levelTone = (level: string | null): string =>
  LEVEL_TONE[level?.toLowerCase() ?? ''] ?? 'border-border-soft bg-muted/40 text-muted-foreground';

export const IssueDetailPanel = ({ issue, sessionId, workspaceId, onClose }: Props) => {
  const createSession = useAppStore((s) => s.createSession);
  const loadSetting = useAppStore((s) => s.loadSetting);
  const { showToast } = useToast();

  const [goal, setGoal] = useState('');
  const [branchSlug, setBranchSlug] = useState('');
  const [branchPrefix, setBranchPrefix] = useState(DEFAULT_BRANCH_PREFIX);
  const [detail, setDetail] = useState<SentryIssueDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [setupWorkflow, setSetupWorkflow] = useState(() => {
    try {
      return localStorage.getItem('goodboy:new-session-setup-workflow') !== '0';
    } catch {
      return true;
    }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastGenRef = useRef('');

  useEffect(() => {
    if (!issue) {
      return;
    }
    const initial = goalFromSentry(issue);
    lastGenRef.current = initial;
    setGoal(initial);
    setBranchSlug(slugify(issue.title));
    setDetail(null);
    setDetailError(null);
    setError(null);
    setBusy(false);
  }, [issue]);

  useEffect(() => {
    if (!issue) {
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    sentryFetchIssueDetail(workspaceId, issue.id)
      .then((d) => {
        if (cancelled) {
          return;
        }
        setDetail(d);
        const regenerated = goalFromSentry(issue, d);
        const prevGen = lastGenRef.current;
        lastGenRef.current = regenerated;
        setGoal((cur) => (cur === prevGen ? regenerated : cur));
      })
      .catch((err) => {
        if (!cancelled) {
          setDetailError(formatError(err));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDetailLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [issue, workspaceId]);

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
          description="Pick an issue to see its stack trace and launch a session."
        />
      </div>
    );
  }

  const canLaunch = goal.trim().length > 0 && isValidBranchSlug(branchSlug) && !busy;
  const missingBase = error !== null && isMissingBaseRefError(error);

  const onLaunch = async () => {
    setError(null);
    setBusy(true);
    try {
      const { session } = await createSession({
        workspaceId,
        goal,
        branchPrefix: sanitizePrefix(branchPrefix).trim() || DEFAULT_BRANCH_PREFIX,
        branchSlug: branchSlug.trim() || undefined,
        externalTask: {
          provider: 'sentry',
          externalId: issue.id,
          identifier: issue.shortId ?? issue.id,
          url: issue.permalink ?? '',
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

  const frames = detail?.frames ?? [];

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-col gap-2 px-8 py-4">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'shrink-0 rounded border px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wide',
              levelTone(issue.level),
            )}
          >
            {issue.level ?? 'error'}
          </span>
          {issue.shortId ? (
            <span className="font-mono text-2xs tabular-nums text-muted-foreground">
              {issue.shortId}
            </span>
          ) : null}
          <span className="flex-1" />
          {issue.permalink ? (
            <a
              href={issue.permalink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-2xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Open in Sentry <ExternalLink size={11} aria-hidden />
            </a>
          ) : null}
        </div>
        <h2 className="text-lg font-semibold leading-snug text-foreground">{issue.title}</h2>
        {issue.culprit ? (
          <span className="truncate font-mono text-2xs text-muted-foreground">{issue.culprit}</span>
        ) : null}
      </div>
      <Divider />

      <div className="min-h-0 flex-1">
        <ScrollFade className="mx-auto h-full max-w-3xl px-10 py-8">
          <div className="flex flex-col gap-8">
            <section className="flex flex-col gap-3">
              <SectionHeader
                label="stack trace"
                icon={<Layers size={13} aria-hidden className="text-muted-foreground" />}
              />
              {detailLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground/70">
                  <Loader2 size={13} className="animate-spin" aria-hidden /> Loading latest event…
                </div>
              ) : detailError ? (
                <p className="text-sm text-danger">{detailError}</p>
              ) : frames.length > 0 ? (
                <pre className="overflow-x-auto rounded-lg border border-border-soft bg-subtle/40 p-3 font-mono text-2xs leading-relaxed text-muted-foreground">
                  {frames
                    .map(
                      (f) =>
                        `${f.in_app ? '› ' : '  '}${f.function ?? '?'} (${f.filename ?? '?'}${
                          f.line_no != null ? `:${f.line_no}` : ''
                        })`,
                    )
                    .join('\n')}
                </pre>
              ) : (
                <p className="text-sm italic text-muted-foreground/60">No stack trace available.</p>
              )}
            </section>

            <section className="flex flex-col gap-3">
              <SectionHeader label="launch session" />
              {sessionId ? (
                <div className="flex items-center gap-3 rounded-lg border border-border-soft bg-muted/10 px-4 py-3.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-success/15">
                    <MessagesSquare size={15} className="text-success" aria-hidden />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-medium text-foreground">
                      Session already launched
                    </span>
                    <span className="truncate text-2xs text-muted-foreground">
                      A session is linked to this issue.
                    </span>
                  </div>
                  <OpenSessionButton sessionId={sessionId} onOpened={onClose} />
                </div>
              ) : (
                <div className="flex flex-col gap-4 rounded-lg border border-border-soft bg-muted/10 p-4">
                  <div className="flex flex-col gap-1.5">
                    <SectionHeader
                      label="Goal"
                      icon={<Target size={13} aria-hidden className="text-primary" />}
                    />
                    <Textarea
                      value={goal}
                      onChange={(e) => setGoal(e.target.value)}
                      autoGrow
                      minRows={3}
                      maxRows={12}
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
                  </div>

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
                    <Button onClick={() => void onLaunch()} disabled={!canLaunch}>
                      {busy ? (
                        <>
                          <Loader2 size={13} className="mr-1.5 animate-spin" aria-hidden />
                          Launching…
                        </>
                      ) : (
                        <>
                          Launch session
                          <ArrowRight size={13} className="ml-1.5" aria-hidden />
                        </>
                      )}
                    </Button>
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

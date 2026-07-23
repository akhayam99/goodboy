import { useEffect, useRef, useState } from 'react';
import {
  Button,
  Divider,
  EmptyState,
  Input,
  SectionHeader,
  StatCard,
  Textarea,
  cn,
} from '@goodboy/ui';
import {
  ArrowRight,
  ExternalLink,
  GitBranch,
  Layers,
  MessagesSquare,
  MousePointerClick,
  Target,
} from 'lucide-react';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { OpenSessionButton } from '../../../../shared/components/OpenSessionButton';
import {
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
import { slugifyBranch } from '../../../../shared/utils/slugifyBranch';
import { DEFAULT_BRANCH_PREFIX, settingBranchPrefix } from '../../../settings/settings';
import { goalFromSentry } from '../goal-from-sentry';
import type { SentryIssue } from '../client';
import { levelTone } from '../levelTone';
import { SentryBreadcrumbs } from '../SentryBreadcrumbs';
import { SentryStackTrace } from '../SentryStackTrace';
import { useSentryIssueDetail } from '../useSentryIssueDetail';
import { visibleSentryTags } from '../visibleSentryTags';

type Props = {
  readonly issue: SentryIssue | null;
  readonly sessionId: SessionId | null;
  readonly workspaceId: WorkspaceId;
  readonly onClose: () => void;
};

const SLUG_MAX_LEN = 30;

const slugify = (input: string): string => slugifyBranch({ input, maxLength: SLUG_MAX_LEN });

const sanitizeSlug = (input: string): string =>
  sanitizeBranchSlug({ input, maxLength: SLUG_MAX_LEN });

const sanitizePrefix = (input: string): string => sanitizeBranchPrefix({ input });

const isValidBranchSlug = (slug: string): boolean => validateBranchSlug({ slug });

export const IssueDetailPanel = ({ issue, sessionId, workspaceId, onClose }: Props) => {
  const createSession = useAppStore((s) => s.createSession);
  const loadSetting = useAppStore((s) => s.loadSetting);
  const { showToast } = useToast();

  const [goal, setGoal] = useState('');
  const [branchSlug, setBranchSlug] = useState('');
  const [branchPrefix, setBranchPrefix] = useState(DEFAULT_BRANCH_PREFIX);
  const {
    detail,
    isLoading: detailLoading,
    error: detailError,
  } = useSentryIssueDetail({
    workspaceId,
    issueId: issue?.id ?? null,
  });
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
    setError(null);
    setBusy(false);
  }, [issue]);

  useEffect(() => {
    if (issue == null || detail == null || detail.issueId !== issue.id) {
      return;
    }
    const regenerated = goalFromSentry(issue, detail);
    const previousGenerated = lastGenRef.current;
    lastGenRef.current = regenerated;
    setGoal((current) => (current === previousGenerated ? regenerated : current));
  }, [detail, issue]);

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

  const launch = (
    <section className="flex flex-col gap-3">
      <SectionHeader label="launch session" />
      {sessionId ? (
        <div className="flex items-center gap-3 rounded-lg border border-border-soft bg-muted/10 px-4 py-3.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-success/15">
            <MessagesSquare size={15} className="text-success" aria-hidden />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-medium text-foreground">Session already launched</span>
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
          </div>
        </div>
      )}
    </section>
  );

  const identifier = issue.shortId ?? issue.id;
  const culprit = detail?.culprit ?? issue.culprit;
  const permalink = issue.permalink;
  const visibleTags = visibleSentryTags({ detail });
  const frames = detail?.frames ?? [];
  const breadcrumbs = detail?.breadcrumbs ?? [];
  const firstSeen = issue.firstSeen == null ? '' : formatRelativeDuration(issue.firstSeen);
  const lastSeen = issue.lastSeen == null ? '' : formatRelativeDuration(issue.lastSeen);
  const stats = [
    ...(issue.count != null ? [{ label: 'Events', value: issue.count }] : []),
    ...(issue.userCount != null ? [{ label: 'Users', value: String(issue.userCount) }] : []),
    ...(firstSeen !== '' ? [{ label: 'First seen', value: `${firstSeen} ago` }] : []),
    ...(lastSeen !== '' ? [{ label: 'Last seen', value: `${lastSeen} ago` }] : []),
  ];

  return (
    <StudioDetailLayout
      header={
        <HeaderBand
          meta={
            <>
              <span
                className={cn(
                  'shrink-0 rounded border px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wide',
                  levelTone({ level: issue.level }),
                )}
              >
                {issue.level ?? 'error'}
              </span>
              <span className="font-mono text-2xs tabular-nums text-muted-foreground">
                {identifier}
              </span>
            </>
          }
          title={detail?.title ?? issue.title}
          subtitle={
            culprit != null ? (
              <span className="truncate font-mono text-2xs text-muted-foreground">{culprit}</span>
            ) : undefined
          }
          actions={
            permalink != null && permalink !== '' ? (
              <a
                href={permalink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-2xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Open in Sentry <ExternalLink size={11} aria-hidden />
              </a>
            ) : undefined
          }
        />
      }
      rail={
        <>
          {launch}
          <Divider />
          {visibleTags.map((tag) => (
            <MetaItem key={tag.key} label={tag.key}>
              {tag.value}
            </MetaItem>
          ))}
          {issue.status != null ? <MetaItem label="Status">{issue.status}</MetaItem> : null}
        </>
      }
    >
      {stats.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {stats.map((stat) => (
            <StatCard key={stat.label} label={stat.label} value={stat.value} valueSize="lg" />
          ))}
        </div>
      ) : null}

      <section className="flex flex-col gap-3">
        <SectionHeader
          label="stack trace"
          icon={<Layers size={13} aria-hidden className="text-muted-foreground" />}
        />
        <SentryStackTrace frames={frames} isLoading={detailLoading} error={detailError} />
      </section>

      <SentryBreadcrumbs breadcrumbs={breadcrumbs} isLoading={detailLoading} error={detailError} />
    </StudioDetailLayout>
  );
};

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PrDetail, PrReview, PrReviewState, PullRequestState } from '@goodboy/types';
import { cn, Divider, SectionHeader } from '@goodboy/ui';
import {
  AlertCircle,
  Check,
  CheckCheck,
  CircleDashed,
  FileText,
  ListChecks,
  Loader2,
  MessageSquare,
  MinusCircle,
  Plus,
  Search,
  Sparkles,
} from 'lucide-react';
import { PullRequestChip } from '../PullRequestChip';
import { computeTabStatus, TabBadge } from '../Card';
import { ghRepoCollaborators } from '../../github';
import { useCurrentWorkspace } from '../../../../store';
import { ScrollFade } from '../../../../shared/components/ScrollFade';
import { PrSwitcher } from './PrSwitcher';

export type PrSection = 'overview' | 'comments' | 'resolve' | 'ci';

const NAV: ReadonlyArray<{
  key: PrSection;
  label: string;
  icon: typeof FileText;
  status?: keyof ReturnType<typeof computeTabStatus>;
}> = [
  { key: 'overview', label: 'Overview', icon: FileText },
  { key: 'comments', label: 'Conversation', icon: MessageSquare, status: 'comments' },
  { key: 'resolve', label: 'Resolve', icon: Sparkles },
  { key: 'ci', label: 'Checks', icon: ListChecks, status: 'ci' },
];

type Props = {
  readonly pr: PullRequestState;
  readonly options: ReadonlyArray<PullRequestState>;
  readonly selected: number | null;
  readonly onSelectPr: (n: number) => void;
  readonly detail: PrDetail | null;
  readonly section: PrSection;
  readonly onSection: (s: PrSection) => void;
  readonly workspaceRoot: string | null;
  readonly onAddReviewers: (logins: ReadonlyArray<string>) => void;
};

export function PrSidebar({
  pr,
  options,
  selected,
  onSelectPr,
  detail,
  section,
  onSection,
  workspaceRoot,
  onAddReviewers,
}: Props) {
  const tabStatus = useMemo(() => computeTabStatus(pr, detail), [pr, detail]);
  const openResolveCount = useMemo(
    () =>
      (detail?.comments ?? []).filter((c) => c.source === 'review' && c.resolved === false).length,
    [detail?.comments],
  );
  const requests = detail?.reviewRequests ?? [];
  const reviewed = useMemo(() => latestReviews(detail?.reviews ?? []), [detail?.reviews]);
  const known = useMemo(
    () =>
      new Set([
        ...requests.map((r) => r.login.toLowerCase()),
        ...reviewed.map((r) => r.author.toLowerCase()),
      ]),
    [requests, reviewed],
  );

  return (
    <aside className="flex w-72 shrink-0 flex-col">
      <div className="flex flex-col gap-2 px-3 py-3">
        <div className="flex items-center gap-1.5">
          {options.length > 1 ? (
            <PrSwitcher prs={options} selected={selected} onSelect={onSelectPr} />
          ) : (
            <PullRequestChip state={pr.state} variant="badge" number={pr.number} iconSize={12} />
          )}
        </div>
        <h2
          className="line-clamp-2 text-sm font-semibold leading-snug text-foreground"
          title={pr.title}
        >
          {pr.title}
        </h2>
      </div>

      <Divider />

      <nav className="flex flex-col gap-0.5 p-2">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = section === item.key;
          const status = item.status ? tabStatus[item.status] : null;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSection(item.key)}
              className={cn(
                'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors',
                active
                  ? 'bg-primary/10 text-foreground ring-1 ring-primary/30'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
            >
              <Icon size={14} aria-hidden className="shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.key === 'resolve' && openResolveCount > 0 ? (
                <span
                  className={cn(
                    'inline-flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums',
                    active ? 'bg-accent/20 text-accent' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {openResolveCount}
                </span>
              ) : status ? (
                <TabBadge status={status} dim={!active} />
              ) : null}
            </button>
          );
        })}
      </nav>

      <Divider />

      <ScrollFade className="min-h-0 flex-1">
        <div className="flex flex-col gap-1.5 px-3 py-3">
          <SectionHeader
            label="Reviewers"
            action={
              <ReviewerPicker
                workspaceRoot={workspaceRoot}
                exclude={known}
                onAdd={(logins) => onAddReviewers(logins)}
              />
            }
          />
          {reviewed.length === 0 && requests.length === 0 ? (
            <span className="text-2xs text-muted-foreground/60">No reviewers yet.</span>
          ) : (
            <ul className="flex flex-col gap-1">
              {reviewed.map((r) => (
                <li key={r.author} className="flex items-center gap-1.5 text-xs text-foreground">
                  <ReviewStateIcon state={r.state} />
                  <Avatar url={r.authorAvatarUrl} alt={r.author} />
                  <span className="min-w-0 flex-1 truncate">{r.author}</span>
                </li>
              ))}
              {requests.map((r) => (
                <li
                  key={`${r.kind}-${r.login}`}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <CircleDashed size={12} aria-hidden className="shrink-0 text-info" />
                  <Avatar url={r.avatarUrl} alt={r.login} />
                  <span className="min-w-0 flex-1 truncate">{r.login}</span>
                  <span className="shrink-0 text-[9px] uppercase tracking-wide opacity-60">
                    awaiting
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </ScrollFade>
    </aside>
  );
}

function ReviewerPicker({
  workspaceRoot,
  exclude,
  onAdd,
}: {
  workspaceRoot: string | null;
  exclude: ReadonlySet<string>;
  onAdd: (logins: ReadonlyArray<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [logins, setLogins] = useState<ReadonlyArray<string> | null>(null);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const workspaceId = useCurrentWorkspace()?.id;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (!open || logins !== null || !workspaceRoot) return;
    setLoading(true);
    void ghRepoCollaborators(workspaceRoot, workspaceId)
      .then(setLogins)
      .catch(() => setLogins([]))
      .finally(() => setLoading(false));
  }, [open, logins, workspaceRoot, workspaceId]);

  const candidates = (logins ?? [])
    .filter((l) => !exclude.has(l.toLowerCase()))
    .filter((l) => l.toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, 8);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="request review"
        aria-label="request review"
        className="inline-flex items-center gap-0.5 rounded border border-border-soft px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:border-border hover:text-foreground"
      >
        <Plus size={11} aria-hidden />
        Add
      </button>
      {open ? (
        <div className="absolute right-0 top-6 z-10 flex w-52 flex-col gap-1 rounded-md border border-border-soft bg-background p-1.5 shadow-lg">
          <div className="flex items-center gap-1.5 rounded border border-border-soft px-1.5 py-1">
            <Search size={12} aria-hidden className="shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="filter collaborators"
              className="w-full bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/60"
            />
          </div>
          {loading ? (
            <span className="flex items-center gap-1.5 px-1.5 py-1 text-2xs text-muted-foreground">
              <Loader2 size={11} aria-hidden className="animate-spin" />
              loading
            </span>
          ) : candidates.length === 0 ? (
            <span className="px-1.5 py-1 text-2xs text-muted-foreground/60">No matches.</span>
          ) : (
            <ul className="max-h-44 overflow-y-auto">
              {candidates.map((login) => (
                <li key={login}>
                  <button
                    type="button"
                    onClick={() => {
                      onAdd([login]);
                      setOpen(false);
                      setQuery('');
                    }}
                    className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs text-foreground hover:bg-muted/60"
                  >
                    <Avatar url={null} alt={login} />
                    <span className="min-w-0 flex-1 truncate">{login}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

function latestReviews(reviews: ReadonlyArray<PrReview>): ReadonlyArray<PrReview> {
  const map = new Map<string, PrReview>();
  for (const r of [...reviews].sort((a, b) =>
    (a.submittedAt ?? '').localeCompare(b.submittedAt ?? ''),
  )) {
    if (r.state === 'commented' || r.state === 'pending' || r.state === 'dismissed') continue;
    map.set(r.author, r);
  }
  return [...map.values()];
}

function ReviewStateIcon({ state }: { state: PrReviewState }) {
  const props = { size: 12, 'aria-hidden': true } as const;
  if (state === 'approved') return <CheckCheck {...props} className="shrink-0 text-success" />;
  if (state === 'changes_requested')
    return <AlertCircle {...props} className="shrink-0 text-danger" />;
  if (state === 'dismissed')
    return <MinusCircle {...props} className="shrink-0 text-muted-foreground" />;
  return <Check {...props} className="shrink-0 text-muted-foreground" />;
}

function Avatar({ url, alt }: { url: string | null; alt: string }) {
  if (!url) {
    return (
      <span
        aria-hidden
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted text-[8px] font-semibold text-muted-foreground"
      >
        {alt.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return <img src={url} alt={alt} className="h-4 w-4 shrink-0 rounded-full" loading="lazy" />;
}

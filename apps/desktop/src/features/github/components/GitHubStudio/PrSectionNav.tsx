import { useMemo } from 'react';
import type { PrDetail, PullRequestState } from '@goodboy/types';
import { cn } from '@goodboy/ui';
import { FileText, ListChecks, MessageSquare, Sparkles } from 'lucide-react';
import { computeTabStatus, TabBadge } from '../Card';
import type { PrSection } from './prSection';

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
  readonly detail: PrDetail | null;
  readonly section: PrSection;
  readonly onSection: (section: PrSection) => void;
};

export const PrSectionNav = ({ pr, detail, section, onSection }: Props) => {
  const tabStatus = useMemo(() => computeTabStatus(pr, detail), [pr, detail]);
  const openResolveCount = useMemo(
    () =>
      (detail?.comments ?? []).filter(
        (comment) => comment.source === 'review' && comment.resolved === false,
      ).length,
    [detail?.comments],
  );

  return (
    <nav className="flex flex-col gap-0.5 p-2">
      {NAV.map((item) => {
        const Icon = item.icon;
        const isActive = section === item.key;
        const status = item.status != null ? tabStatus[item.status] : null;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onSection(item.key)}
            className={cn(
              'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors',
              isActive
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
                  isActive ? 'bg-accent/20 text-accent' : 'bg-muted text-muted-foreground',
                )}
              >
                {openResolveCount}
              </span>
            ) : status != null ? (
              <TabBadge status={status} dim={isActive === false} />
            ) : null}
          </button>
        );
      })}
    </nav>
  );
};

import {
  Check,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  GitPullRequestDraft,
} from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { PullRequestStateKind } from '@goodboy/types';

type PrStateMeta = {
  readonly icon: React.ElementType;
  readonly label: string;
  readonly textClass: string;
  readonly bgClass: string;
};

const PR_META: Record<PullRequestStateKind, PrStateMeta> = {
  draft: {
    icon: GitPullRequestDraft,
    label: 'Draft',
    textClass: 'text-muted-foreground',
    bgClass: 'bg-muted/40',
  },
  open: {
    icon: GitPullRequest,
    label: 'In review',
    textClass: 'text-success',
    bgClass: 'bg-success/12',
  },
  approved: {
    icon: Check,
    label: 'Approved',
    textClass: 'text-success',
    bgClass: 'bg-success/18',
  },
  merged: {
    icon: GitMerge,
    label: 'Merged',
    textClass: 'text-merged',
    bgClass: 'bg-[oklch(from_var(--color-merged)_l_c_h_/_0.15)]',
  },
  closed: {
    icon: GitPullRequestClosed,
    label: 'Closed',
    textClass: 'text-danger',
    bgClass: 'bg-danger/10',
  },
};

export const pullRequestMeta = (state: PullRequestStateKind): PrStateMeta => {
  return PR_META[state];
};

type Variant = 'icon' | 'compact' | 'badge';

type Props = {
  readonly state: PullRequestStateKind;
  readonly variant?: Variant;
  readonly number?: number;
  readonly iconSize?: number;
  readonly className?: string;
};

export const PullRequestChip = ({
  state,
  variant = 'icon',
  number,
  iconSize,
  className,
}: Props) => {
  const meta = PR_META[state];
  const Icon = meta.icon;

  if (variant === 'icon') {
    return (
      <span
        title={meta.label + (number !== undefined ? ` · #${number}` : '')}
        aria-label={meta.label + (number !== undefined ? ` (#${number})` : '')}
        className={cn('inline-flex shrink-0', meta.textClass, className)}
      >
        <Icon size={iconSize ?? 10} aria-hidden />
      </span>
    );
  }

  if (variant === 'compact') {
    return (
      <span
        title={meta.label}
        className={cn(
          'inline-flex items-center gap-1 text-2xs font-medium',
          meta.textClass,
          className,
        )}
      >
        <Icon size={iconSize ?? 12} aria-hidden />
        {number !== undefined && <span>#{number}</span>}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em]',
        meta.textClass,
        meta.bgClass,
        className,
      )}
    >
      <Icon size={iconSize ?? 10} aria-hidden />
      <span>{meta.label}</span>
      {number !== undefined && (
        <>
          <span aria-hidden className="opacity-40">
            ·
          </span>
          <span className="normal-case tracking-normal">#{number}</span>
        </>
      )}
    </span>
  );
};

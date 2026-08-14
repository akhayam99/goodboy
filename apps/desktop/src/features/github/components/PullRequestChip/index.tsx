import {
  Check,
  CircleDashed,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  GitPullRequestDraft,
  ListChecks,
} from 'lucide-react';
import { Chip, cn, type Tone } from '@goodboy/ui';
import type { PullRequestStateKind } from '@goodboy/types';

type PrStateMeta = {
  readonly icon: React.ElementType;
  readonly label: string;
  readonly textClass: string;
  readonly tone: Tone;
};

type PullRequestChipState = PullRequestStateKind | 'none';

const PR_META: Record<PullRequestChipState, PrStateMeta> = {
  none: {
    icon: CircleDashed,
    label: 'No pull request',
    textClass: 'text-muted-foreground/50',
    tone: 'neutral',
  },
  draft: {
    icon: GitPullRequestDraft,
    label: 'Draft',
    textClass: 'text-muted-foreground',
    tone: 'neutral',
  },
  open: {
    icon: GitPullRequest,
    label: 'In review',
    textClass: 'text-success',
    tone: 'success',
  },
  approved: {
    icon: Check,
    label: 'Approved',
    textClass: 'text-success',
    tone: 'success',
  },
  queued: {
    icon: ListChecks,
    label: 'Queued',
    textClass: 'text-primary',
    tone: 'primary',
  },
  merged: {
    icon: GitMerge,
    label: 'Merged',
    textClass: 'text-merged',
    tone: 'merged',
  },
  closed: {
    icon: GitPullRequestClosed,
    label: 'Closed',
    textClass: 'text-danger',
    tone: 'danger',
  },
};

export const pullRequestMeta = (state: PullRequestChipState): PrStateMeta => {
  return PR_META[state];
};

type Variant = 'icon' | 'compact' | 'badge';

type Props = {
  readonly state: PullRequestChipState;
  readonly variant?: Variant;
  readonly number?: number;
  readonly iconSize?: number;
  readonly className?: string;
  readonly title?: string;
};

export const PullRequestChip = ({
  state,
  variant = 'icon',
  number,
  iconSize,
  className,
  title,
}: Props) => {
  const meta = PR_META[state];
  const Icon = meta.icon;
  const description = title ?? meta.label + (number !== undefined ? ` · #${number}` : '');

  if (variant === 'icon') {
    return (
      <span
        title={description}
        aria-label={description}
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
    <Chip
      tone={meta.tone}
      size="3xs"
      uppercase
      bordered={false}
      icon={<Icon size={iconSize ?? 10} aria-hidden />}
      label={<span>{meta.label}</span>}
      trailing={
        number !== undefined ? (
          <>
            <span aria-hidden className="opacity-40">
              ·
            </span>
            <span className="normal-case tracking-normal">#{number}</span>
          </>
        ) : undefined
      }
      className={cn('shrink-0', meta.textClass, className)}
    />
  );
};

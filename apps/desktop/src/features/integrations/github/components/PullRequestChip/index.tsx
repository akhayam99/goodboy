import { Chip, cn, Tooltip } from '@goodboy/ui';
import {
  PULL_REQUEST_PRESENTATION,
  type PullRequestPresentationState,
} from '../../../../../shared/pullRequestPresentation';

type MetaParams = {
  readonly state: PullRequestPresentationState;
};

export const pullRequestMeta = ({ state }: MetaParams) => PULL_REQUEST_PRESENTATION[state];

type Variant = 'icon' | 'compact' | 'badge';

type Props = {
  readonly state: PullRequestPresentationState;
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
  const meta = PULL_REQUEST_PRESENTATION[state];
  const Icon = meta.icon;
  const description = title ?? meta.label + (number !== undefined ? ` · #${number}` : '');

  if (variant === 'icon') {
    return (
      <Tooltip content={description}>
        <span
          aria-label={description}
          className={cn('inline-flex shrink-0', meta.textClass, className)}
        >
          <Icon size={iconSize ?? 10} aria-hidden />
        </span>
      </Tooltip>
    );
  }

  if (variant === 'compact') {
    return (
      <Tooltip content={meta.label}>
        <span className={cn('inline-flex items-center gap-1 text-chip', meta.textClass, className)}>
          <Icon size={iconSize ?? 12} aria-hidden />
          {number !== undefined && <span>#{number}</span>}
        </span>
      </Tooltip>
    );
  }

  return (
    <Chip
      tone={meta.tone}
      kind="state"
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

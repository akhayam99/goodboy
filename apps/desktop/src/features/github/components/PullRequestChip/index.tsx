import { Chip, cn } from '@goodboy/ui';
import {
  PULL_REQUEST_PRESENTATION,
  type PullRequestPresentationState,
} from '../../../../shared/pullRequestPresentation';

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

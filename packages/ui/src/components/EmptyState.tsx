import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../cn';
import { tintClasses } from '../tint';
import type { Tone } from '../tint';

type IllustrationProps =
  | {
      readonly icon: LucideIcon;
      readonly illustration?: never;
    }
  | {
      readonly icon?: never;
      readonly illustration: ReactNode;
    };

type Size = 'inline' | 'sm' | 'lg' | 'xl';

const HEADING_TAG = { 2: 'h2', 3: 'h3' } as const;

const DEFAULT_PRESENTATION = {
  bordered: false,
  tone: 'neutral',
  size: 'sm',
} satisfies {
  readonly bordered: boolean;
  readonly tone: Tone;
  readonly size: Size;
};

const SIZE_CLASSES = {
  inline: {
    root: 'flex items-start gap-2.5 px-3 py-2.5 text-left',
    content: 'flex min-w-0 flex-1 flex-col gap-1',
    title: 'text-xs font-medium text-foreground',
    description: 'text-xs leading-relaxed text-muted-foreground',
  },
  sm: {
    root: 'flex flex-col items-center gap-3 px-6 py-10 text-center',
    content: 'flex flex-col gap-1',
    title: 'text-sm font-medium text-foreground',
    description: 'max-w-xs text-xs leading-relaxed text-muted-foreground',
  },
  lg: {
    root: 'flex flex-col items-center gap-6 px-8 py-10 text-center',
    content: 'flex flex-col gap-2.5',
    title: 'text-lg font-semibold tracking-tight text-foreground',
    description: 'max-w-sm text-sm leading-relaxed text-muted-foreground',
  },
  xl: {
    root: 'flex flex-col items-center gap-10 px-10 py-14 text-center',
    content: 'flex flex-col gap-3',
    title: 'text-2xl font-semibold tracking-tight text-foreground',
    description: 'max-w-md text-sm leading-relaxed text-muted-foreground',
  },
} satisfies Record<
  Size,
  {
    readonly root: string;
    readonly content: string;
    readonly title: string;
    readonly description: string;
  }
>;

export type EmptyStateProps = IllustrationProps & {
  readonly title: string;
  readonly description?: string;
  readonly action?: ReactNode;
  readonly bordered?: boolean;
  readonly tone?: Tone;
  readonly className?: string;
  readonly size?: Size;
  readonly headingLevel?: 2 | 3;
};

export const EmptyState = ({
  icon: Icon,
  illustration,
  title,
  description,
  action,
  bordered = DEFAULT_PRESENTATION.bordered,
  tone = DEFAULT_PRESENTATION.tone,
  className,
  size = DEFAULT_PRESENTATION.size,
  headingLevel,
}: EmptyStateProps) => {
  const tint = tintClasses(tone);
  const classes = SIZE_CLASSES[size];
  const Title = headingLevel == null ? 'span' : HEADING_TAG[headingLevel];
  const Description = headingLevel == null ? 'span' : 'p';
  const isInline = size === 'inline';

  return (
    <div
      className={cn(
        classes.root,
        bordered && 'rounded-lg border border-dashed border-border-soft bg-elevated/40',
        className,
      )}
    >
      {Icon != null && isInline ? (
        <Icon size={14} aria-hidden className={cn('mt-0.5 shrink-0', tint.icon)} />
      ) : null}
      {Icon != null && !isInline ? (
        <span
          className={cn(
            'flex size-12 items-center justify-center rounded-full',
            tint.bg,
            tint.icon,
          )}
        >
          <Icon size={24} aria-hidden />
        </span>
      ) : null}
      {Icon == null ? illustration : null}
      <div className={classes.content}>
        <Title className={classes.title}>{title}</Title>
        {description != null && description !== '' ? (
          <Description className={classes.description}>{description}</Description>
        ) : null}
      </div>
      {action != null ? (
        <div className={cn(isInline && 'shrink-0 self-center')}>{action}</div>
      ) : null}
    </div>
  );
};

type LensEmptyStateProps = IllustrationProps &
  Omit<EmptyStateProps, keyof IllustrationProps | 'bordered' | 'size'> & {
    readonly description: string;
  };

export const LensEmptyState = (props: LensEmptyStateProps) => (
  <EmptyState {...props} bordered size="inline" />
);

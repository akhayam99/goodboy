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

type Size = 'sm' | 'lg' | 'xl';

const HEADING_TAG = { 2: 'h2', 3: 'h3' } as const;

const SIZE_CLASSES = {
  sm: {
    root: 'flex flex-col items-center gap-3 px-6 py-10 text-center',
    content: 'flex flex-col gap-1',
    title: 'text-sm font-medium text-foreground',
    description: 'max-w-xs text-xs leading-relaxed text-muted-foreground',
  },
  lg: {
    root: 'flex flex-col items-center gap-6 text-center',
    content: 'flex flex-col gap-2.5',
    title: 'text-lg font-semibold tracking-tight text-foreground',
    description: 'max-w-sm text-sm leading-relaxed text-muted-foreground',
  },
  xl: {
    root: 'flex flex-col items-center gap-10 text-center',
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
  bordered = false,
  tone,
  className,
  size = 'sm',
  headingLevel,
}: EmptyStateProps) => {
  const tint = tone != null ? tintClasses(tone) : null;
  const iconBg = tint != null ? tint.bg : 'bg-muted';
  const iconColor = tint != null ? tint.icon : 'text-muted-foreground';
  const classes = SIZE_CLASSES[size];
  const Title = headingLevel != null ? HEADING_TAG[headingLevel] : 'span';
  const Description = headingLevel != null ? 'p' : 'span';

  return (
    <div
      className={cn(
        classes.root,
        bordered && 'rounded-lg border border-dashed border-border-soft bg-elevated/40',
        className,
      )}
    >
      {Icon != null ? (
        <span
          className={cn('flex size-12 items-center justify-center rounded-full', iconBg, iconColor)}
        >
          <Icon size={24} aria-hidden />
        </span>
      ) : (
        illustration
      )}
      <div className={classes.content}>
        <Title className={classes.title}>{title}</Title>
        {description != null && description !== '' ? (
          <Description className={classes.description}>{description}</Description>
        ) : null}
      </div>
      {action ?? null}
    </div>
  );
};

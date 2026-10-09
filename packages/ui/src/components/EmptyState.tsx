import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../cn';
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

type Layout = 'page' | 'section';

type Size = Layout;

const HEADING_TAG = { 2: 'h2', 3: 'h3' } as const;

const PAGE_CLASSES = {
  root: 'flex flex-col items-center gap-4 px-6 py-10 text-center',
  content: 'flex flex-col items-center gap-1',
  title: 'text-heading text-foreground',
  description: 'max-w-sm text-prose text-muted-foreground',
} as const;

const SECTION_CLASSES = {
  root: 'flex min-h-7 min-w-0 items-center gap-2 text-label',
  content: 'min-w-0 flex-1',
  title: 'font-medium text-foreground',
  description: 'text-muted-foreground',
} as const;

const PAGE_ICON_SIZE = 18;
const SECTION_ICON_SIZE = 14;

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

type LayoutParams = {
  readonly size: Size | undefined;
  readonly bordered: boolean;
};

const layoutOf = ({ size, bordered }: LayoutParams): Layout => {
  if (size !== undefined) {
    return size;
  }
  return bordered ? 'page' : 'section';
};

export const EmptyState = ({
  icon: Icon,
  illustration,
  title,
  description,
  action,
  bordered = false,
  className,
  size,
  headingLevel,
}: EmptyStateProps) => {
  const layout = layoutOf({ size, bordered });
  const level = headingLevel ?? (size === 'page' ? 2 : undefined);
  const Title = level === undefined ? 'span' : HEADING_TAG[level];
  const Description = level === undefined ? 'span' : 'p';
  const hasDescription = description !== undefined && description !== '';

  if (layout === 'section') {
    return (
      <div className={cn(SECTION_CLASSES.root, className)}>
        {Icon !== undefined ? (
          <Icon size={SECTION_ICON_SIZE} aria-hidden className="shrink-0 text-muted-foreground" />
        ) : (
          illustration
        )}
        <div className={SECTION_CLASSES.content}>
          <Title className={SECTION_CLASSES.title}>{title}</Title>
          {hasDescription ? (
            <>
              {' '}
              <Description className={SECTION_CLASSES.description}>{description}</Description>
            </>
          ) : null}
        </div>
        {action !== undefined && action !== null ? <div className="shrink-0">{action}</div> : null}
      </div>
    );
  }

  const classes = PAGE_CLASSES;

  return (
    <div className={cn(classes.root, className)}>
      {Icon !== undefined ? (
        <Icon size={PAGE_ICON_SIZE} aria-hidden className="shrink-0 text-muted-foreground" />
      ) : (
        illustration
      )}
      <div className={classes.content}>
        <Title className={classes.title}>{title}</Title>
        {hasDescription ? (
          <Description className={classes.description}>{description}</Description>
        ) : null}
      </div>
      {action !== undefined && action !== null ? <div>{action}</div> : null}
    </div>
  );
};

type FilledEmptyStateProps = IllustrationProps &
  Omit<EmptyStateProps, keyof IllustrationProps | 'bordered' | 'size'> & {
    readonly description?: string;
  };

export const FilledEmptyState = (props: FilledEmptyStateProps) => (
  <EmptyState {...props} size="section" />
);

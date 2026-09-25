import { useId, useState, type ReactNode } from 'react';
import { ChevronRight, CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { cn } from '../../cn';
import { FOCUS_RING } from '../../focusRing';
import { tintClasses } from '../../tint';

export type NoticeTone = 'danger' | 'warning' | 'info' | 'success';

export type NoticePlacement = 'transcript' | 'inline' | 'banner' | 'floating';

type Props = {
  readonly tone: NoticeTone;
  readonly placement: NoticePlacement;
  readonly title: ReactNode;
  readonly body?: ReactNode;
  readonly detail?: string | null;
  readonly actions?: ReactNode;
  readonly role?: 'alert' | 'status';
  readonly className?: string;
  readonly iconTestId?: string;
  readonly children?: ReactNode;
};

const TONE_ICON = {
  danger: CircleAlert,
  warning: TriangleAlert,
  info: Info,
  success: CircleCheck,
} as const satisfies Record<NoticeTone, unknown>;

const PLACEMENT_SURFACE = {
  transcript: 'bg-transparent py-1.5 pl-3.5 pr-3',
  inline: 'rounded-lg border border-border-soft bg-subtle py-2.5 pl-3.5 pr-3',
  banner: 'rounded-lg border border-border-soft bg-subtle py-2.5 pl-3.5 pr-3',
  floating: 'rounded-lg border border-border-soft bg-floating py-3 pl-4 pr-3 shadow-lg',
} as const satisfies Record<NoticePlacement, string>;

const PLACEMENT_RAIL = {
  transcript: 'w-0.5',
  inline: 'w-0.5',
  banner: 'w-0.5',
  floating: 'w-1',
} as const satisfies Record<NoticePlacement, string>;

const PLACEMENT_TITLE = {
  transcript: 'text-xs leading-4',
  inline: 'text-xs leading-4',
  banner: 'text-xs leading-4',
  floating: 'text-sm',
} as const satisfies Record<NoticePlacement, string>;

const PLACEMENT_ICON_SIZE = {
  transcript: 14,
  inline: 14,
  banner: 14,
  floating: 16,
} as const satisfies Record<NoticePlacement, number>;

type HasContentParams = {
  readonly node: ReactNode;
};

const hasContent = ({ node }: HasContentParams): boolean =>
  node !== undefined && node !== null && node !== false && node !== '';

export const Notice = ({
  tone,
  placement,
  title,
  body,
  detail = null,
  actions,
  role,
  className,
  iconTestId,
  children,
}: Props) => {
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const detailId = useId();
  const tint = tintClasses(tone);
  const Icon = TONE_ICON[tone];
  const hasDetail = detail !== null && detail.trim() !== '';
  const isTitleOnly = !hasContent({ node: body }) && !hasDetail && !hasContent({ node: children });

  return (
    <div
      role={role}
      data-tone={tone}
      data-placement={placement}
      className={cn(
        '@container/notice relative w-full min-w-0 overflow-hidden',
        PLACEMENT_SURFACE[placement],
        className,
      )}
    >
      <span
        aria-hidden
        data-notice-rail
        className={cn('absolute inset-y-0 left-0', PLACEMENT_RAIL[placement], tint.dot)}
      />
      <div
        data-notice-layout
        className={cn(
          'grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2.5 gap-y-2 @md/notice:grid-cols-[auto_minmax(0,1fr)_auto]',
          isTitleOnly && '@md/notice:items-center',
        )}
      >
        <Icon
          size={PLACEMENT_ICON_SIZE[placement]}
          aria-hidden
          {...(iconTestId !== undefined ? { 'data-testid': iconTestId } : {})}
          className={cn('shrink-0', !isTitleOnly && 'mt-px', tint.icon)}
        />
        <div className="flex min-w-0 flex-col items-start gap-1">
          <p
            className={cn(
              'w-full break-words font-semibold text-foreground',
              PLACEMENT_TITLE[placement],
            )}
          >
            {title}
          </p>
          {hasContent({ node: body }) && (
            <div className="w-full break-words text-xs leading-4 text-muted-foreground">{body}</div>
          )}
          {hasDetail && (
            <button
              type="button"
              aria-expanded={isDetailOpen}
              aria-controls={isDetailOpen ? detailId : undefined}
              onClick={() => setIsDetailOpen((open) => !open)}
              className={cn(
                'inline-flex items-center gap-1 rounded-sm text-2xs text-faint-foreground hover:text-muted-foreground',
                FOCUS_RING,
              )}
            >
              <ChevronRight
                size={10}
                aria-hidden
                className={cn('motion-safe:transition-transform', isDetailOpen && 'rotate-90')}
              />
              Details
            </button>
          )}
          {hasDetail && isDetailOpen && (
            <pre
              id={detailId}
              className="max-h-48 w-full overflow-auto whitespace-pre-wrap break-words rounded-md border border-border-soft bg-background px-2.5 py-2 font-mono text-2xs text-muted-foreground"
            >
              {detail}
            </pre>
          )}
          {hasContent({ node: children }) && <div className="w-full">{children}</div>}
        </div>
        {hasContent({ node: actions }) && (
          <div className="col-start-2 flex flex-wrap items-center gap-2 @md/notice:col-start-3 @md/notice:row-start-1">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

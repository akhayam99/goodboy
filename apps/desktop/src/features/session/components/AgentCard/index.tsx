import type { ReactNode } from 'react';
import { cn, tintClasses, type Tone } from '@goodboy/ui';
import { CardActionSlot } from '@goodboy/ui';
import type { AgentCardDensity } from './agentCardDensity';
import type { AgentCardTone } from './agentCardTone';

const AGENT_CARD_TONE: Record<Exclude<AgentCardTone, 'default'>, Tone> = {
  running: 'info',
  attention: 'warning',
  success: 'success',
};

const DENSITY_PADDING: Record<AgentCardDensity, string> = {
  lane: 'px-3 py-2.5',
  sidebar: 'px-2 py-1.5',
};

const DENSITY_BODY_GAP: Record<AgentCardDensity, string> = {
  lane: 'gap-1.5',
  sidebar: 'gap-1',
};

const agentCardBorderClass = (tone: AgentCardTone): string => {
  if (tone === 'default') {
    return '';
  }
  return tintClasses(AGENT_CARD_TONE[tone]).border;
};

type Props = {
  readonly tone?: AgentCardTone;
  readonly density?: AgentCardDensity;
  readonly ariaLabel?: string;
  readonly isSelected: boolean;
  readonly isInspected?: boolean;
  readonly isMuted?: boolean;
  readonly isInert?: boolean;
  readonly rowTitle?: string;
  readonly leading?: ReactNode;
  readonly title: ReactNode;
  readonly navigationAction: ReactNode;
  readonly lifecycleActions?: ReactNode;
  readonly status?: ReactNode;
  readonly meta?: ReactNode;
  readonly footer?: ReactNode;
  readonly children?: ReactNode;
  readonly confirmation?: ReactNode;
  readonly onOpen: () => void;
  readonly onRenameStart?: () => void;
  readonly onMouseEnter?: () => void;
  readonly onMouseLeave?: () => void;
};

export const AgentCard = ({
  tone = 'default',
  density = 'sidebar',
  ariaLabel,
  isSelected,
  isInspected = false,
  isMuted = false,
  isInert = false,
  rowTitle,
  leading,
  title,
  navigationAction,
  lifecycleActions,
  status,
  meta,
  footer,
  children,
  confirmation,
  onOpen,
  onRenameStart,
  onMouseEnter,
  onMouseLeave,
}: Props) => (
  <li className="flex flex-col gap-1" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
    <div
      role={isInert ? undefined : 'button'}
      tabIndex={isInert ? -1 : 0}
      aria-label={isInert ? undefined : ariaLabel}
      aria-pressed={isInert ? undefined : isSelected}
      onClick={isInert ? undefined : onOpen}
      onDoubleClick={isInert || onRenameStart == null ? undefined : onRenameStart}
      onKeyDown={(event) => {
        if (isInert) {
          return;
        }
        if (event.key !== 'Enter' && event.key !== ' ') {
          return;
        }
        event.preventDefault();
        onOpen();
      }}
      className={cn(
        'group/agent-card grid grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_auto] gap-x-2 gap-y-1 rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
        DENSITY_PADDING[density],
        isInert ? '' : 'cursor-pointer',
        isMuted && 'opacity-60',
        isSelected ? 'bg-elevated' : 'bg-muted/40 hover:bg-muted/60',
        tone === 'default' && (isSelected ? 'border-border' : 'border-transparent'),
        agentCardBorderClass(tone),
        isInspected && 'ring-1 ring-inset ring-border',
      )}
    >
      <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-2" title={rowTitle}>
        {leading}
        {title}
      </div>
      <CardActionSlot
        label="Agent navigation actions"
        className="col-start-2 row-start-1 self-start"
      >
        {navigationAction}
      </CardActionSlot>
      {status != null || meta != null || children != null || footer != null ? (
        <div
          className={cn(
            'row-start-2 flex min-w-0 flex-col',
            DENSITY_BODY_GAP[density],
            lifecycleActions == null ? 'col-span-2' : 'col-start-1',
          )}
        >
          {status != null && <div className="flex flex-wrap items-center gap-1.5">{status}</div>}
          {meta}
          {children}
          {footer}
        </div>
      ) : null}
      {lifecycleActions != null && (
        <CardActionSlot
          label="Agent lifecycle actions"
          className="col-start-2 row-start-2 self-end"
        >
          {lifecycleActions}
        </CardActionSlot>
      )}
    </div>
    {confirmation}
  </li>
);

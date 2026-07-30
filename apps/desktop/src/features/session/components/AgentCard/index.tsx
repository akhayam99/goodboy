import type { ReactNode } from 'react';
import { cn } from '@goodboy/ui';
import type { AgentCardTone } from './agentCardTone';

const TONE_CLASS: Record<AgentCardTone, string> = {
  default: '',
  running: 'border-info/60',
  attention: 'border-warning/70',
  success: 'border-success/50',
};

type Props = {
  readonly tone?: AgentCardTone;
  readonly ariaLabel?: string;
  readonly isSelected: boolean;
  readonly isInspected?: boolean;
  readonly isMuted?: boolean;
  readonly isInert?: boolean;
  readonly rowTitle?: string;
  readonly leading?: ReactNode;
  readonly title: ReactNode;
  readonly actions: ReactNode;
  readonly headline?: ReactNode;
  readonly footer?: ReactNode;
  readonly children?: ReactNode;
  readonly onOpen: () => void;
  readonly onRenameStart?: () => void;
};

export const AgentCard = ({
  tone = 'default',
  ariaLabel,
  isSelected,
  isInspected = false,
  isMuted = false,
  isInert = false,
  rowTitle,
  leading,
  title,
  actions,
  headline,
  footer,
  children,
  onOpen,
  onRenameStart,
}: Props) => (
  <li
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
      'group/agent-card flex flex-col gap-1 rounded-lg border px-2 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
      isInert ? '' : 'cursor-pointer',
      isMuted && 'opacity-60',
      isSelected ? 'bg-elevated' : 'bg-muted/40 hover:bg-muted/60',
      tone === 'default' && (isSelected ? 'border-border' : 'border-transparent'),
      TONE_CLASS[tone],
      isInspected && 'ring-1 ring-inset ring-border',
    )}
  >
    <div className="flex items-center gap-2" title={rowTitle}>
      {leading}
      {title}
      {actions}
    </div>
    {headline}
    {children}
    {footer}
  </li>
);

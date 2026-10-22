import { ArrowRight } from 'lucide-react';
import { cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { agentKindPalette, type AgentKind } from '../../agent-kind';
import { AgentKindChip } from '../../../../shared/components/AgentKindChip';

type Props = {
  readonly kind: AgentKind;
  readonly label: string;
  readonly hint: string;
  readonly isBusy: boolean;
  readonly isDisabled: boolean;
  readonly onContinue: () => void;
};

export const AgentFollowUpMove = ({ kind, label, hint, isBusy, isDisabled, onContinue }: Props) => (
  <button
    type="button"
    aria-label={`Continue with ${agentKindPalette({ kind }).label}: ${hint}`}
    aria-busy={isBusy}
    disabled={isDisabled}
    onClick={onContinue}
    className={cn(
      'group flex items-center gap-2 rounded-md border border-border-soft bg-elevated px-3 py-2 text-left text-label transition-colors hover:border-border',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
    )}
  >
    <AgentKindChip kind={kind} title={label} />
    <span className="min-w-0 flex-1 text-foreground">{hint}</span>
    <ArrowRight
      size={ICON_SIZE.row}
      aria-hidden
      className="shrink-0 text-faint-foreground transition-transform group-hover:translate-x-0.5"
    />
  </button>
);

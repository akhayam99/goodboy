import type { ReactNode } from 'react';
import { cn } from '@goodboy/ui';
import { RoutingLabel } from '../../../../../shared/components/RoutingLabel';
import { ROLE_LABEL, kindForRole } from '../../../../session/agent-kind';
import { AgentKindChip } from '../../../../session/components/AgentKindChip';
import type { SavedStep } from '../../../savedSteps';

type Props = {
  readonly step: SavedStep;
  readonly note: string;
  readonly isExpanded: boolean;
  readonly editor: ReactNode;
  readonly onToggle: () => void;
};

export const SavedStepRow = ({ step, note, isExpanded, editor, onToggle }: Props) => {
  const hasRouting = step.providerDefault !== null || step.modelDefault !== null;
  return (
    <li
      className={cn(
        'flex min-w-0 flex-col rounded-lg border',
        isExpanded ? 'border-border-soft bg-subtle' : 'border-transparent',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? 'Close' : 'Open'} ${step.name}`}
        className={cn(
          'flex h-9 w-full min-w-0 items-center gap-2.5 rounded-md px-2 text-left transition-colors',
          !isExpanded && 'hover:bg-hover',
        )}
      >
        <span className="flex w-24 shrink-0">
          <AgentKindChip kind={kindForRole({ role: step.role })} label={ROLE_LABEL[step.role]} />
        </span>
        <span
          className={cn(
            'w-40 shrink-0 truncate text-body text-foreground',
            isExpanded && 'font-medium',
          )}
        >
          {step.name}
        </span>
        <span className="min-w-0 flex-1 truncate text-secondary text-faint-foreground">{note}</span>
        <span className="flex w-36 shrink-0 justify-end text-secondary text-faint-foreground">
          {hasRouting ? (
            <RoutingLabel
              provider={step.providerDefault}
              model={step.modelDefault}
              effort={step.effortDefault}
            />
          ) : (
            'Auto'
          )}
        </span>
      </button>
      {isExpanded ? editor : null}
    </li>
  );
};

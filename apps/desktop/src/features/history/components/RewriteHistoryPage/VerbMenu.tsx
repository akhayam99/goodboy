import { ChevronDown } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { HistoryStep } from '@goodboy/types';
import { VERB_LINE, VERB_WORD } from '../../historyPlan';
import { ObjectOverflowMenu } from '../../../actions/components/ObjectOverflowMenu';
import type { CommitActionTarget } from '../../../actions/types';

type Props = {
  readonly step: HistoryStep;
  readonly target: CommitActionTarget;
  readonly isOnOrigin: boolean;
  readonly disabled: boolean;
};

const short = ({ sha }: { readonly sha: string }): string => sha.slice(0, 7);

export const verbLabel = ({ step }: { readonly step: HistoryStep }): string =>
  step.verb === 'fixup' && step.target != null
    ? `${VERB_WORD.fixup} ${short({ sha: step.target })}`
    : VERB_WORD[step.verb];

export const VerbMenu = ({ step, target, isOnOrigin, disabled }: Props) => {
  const line = step.verb === 'fixup' ? VERB_LINE.fixup : VERB_LINE[step.verb];

  return (
    <ObjectOverflowMenu
      target={target}
      label={`What happens to ${short({ sha: step.sha })}`}
      tooltip={isOnOrigin ? `${line} This commit is on origin.` : line}
      disabled={disabled}
      anchorKey={`commit:${step.sha}`}
      triggerClassName="w-40 px-2"
      trigger={
        <span
          className={cn(
            'flex min-w-0 items-center justify-between gap-1 text-label',
            step.verb === 'pick' ? 'text-faint-foreground' : 'text-foreground',
            step.verb === 'drop' && 'text-danger',
          )}
        >
          <span className="truncate">{verbLabel({ step })}</span>
          <ChevronDown size={11} aria-hidden className="shrink-0" />
        </span>
      }
    />
  );
};

import { SlidersHorizontal } from 'lucide-react';
import type { WorkflowRules } from '@goodboy/types';
import { Button } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { openWorkflowRules } from '../../../openWorkflowRules';
import { autonomyLabel, guidanceRuleText, spendRuleText } from '../../../workflowRulesCopy';

type Props = {
  readonly rules: WorkflowRules;
  readonly providers: string;
};

export const FromRulesRow = ({ rules, providers }: Props) => {
  const items = [
    autonomyLabel({ rules }),
    spendRuleText({ rules }),
    providers,
    guidanceRuleText({ rules }),
  ].filter((item) => item !== '');
  return (
    <div
      data-testid="from-your-rules"
      className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-border-soft bg-subtle px-3 py-2 text-label"
    >
      <span className="inline-flex shrink-0 items-center gap-1.5 text-foreground">
        <SlidersHorizontal size={ICON_SIZE.row} aria-hidden className="text-muted-foreground" />
        From your rules
      </span>
      <span className="min-w-0 flex-1 truncate text-muted-foreground">{items.join(' · ')}</span>
      <Button variant="ghost" size="sm" onClick={openWorkflowRules}>
        Edit
      </Button>
    </div>
  );
};

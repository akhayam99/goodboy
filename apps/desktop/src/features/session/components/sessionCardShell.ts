import { cn as tokenCn, tintClasses as tokenTintClasses } from '@goodboy/ui';
import { cn } from '@goodboy/ui';
import type { SessionStage } from '@goodboy/types';

type Params = {
  readonly stage: SessionStage;
  readonly selected?: boolean;
  readonly active?: boolean;
  readonly dimmed?: boolean;
};

type RestBorderParams = Pick<Params, 'stage' | 'selected'>;

const restBorder = ({ stage, selected }: RestBorderParams): string => {
  if (selected === true) {
    return tokenCn('border-primary', tokenTintClasses('primary').bgSoft);
  }
  if (stage === 'running') {
    return tokenCn(tokenTintClasses('info').border, 'spin-border spin-border-info');
  }
  if (stage === 'attention') {
    return tokenCn(tokenTintClasses('warning').border);
  }
  return 'border-border-soft hover:border-border';
};

export const sessionCardShell = ({ stage, selected, active, dimmed }: Params): string =>
  cn(
    'rounded-lg border bg-elevated text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
    active === true ? 'border-border shadow-sm' : restBorder({ stage, selected }),
    dimmed === true && 'opacity-50',
  );

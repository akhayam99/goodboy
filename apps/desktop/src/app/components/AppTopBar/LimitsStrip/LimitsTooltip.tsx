import type { LimitsChip } from '@goodboy/core';
import { FactCard } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { limitsCardOf } from './limitsCardOf';

type Props = {
  readonly chip: LimitsChip;
  readonly nowMs: number;
  readonly isOpen?: boolean;
  readonly children: React.ComponentProps<typeof FactCard>['children'];
};

export const LimitsTooltip = ({ chip, nowMs, isOpen = false, children }: Props) => {
  const freeResets = useAppStore((state) =>
    chip.providerId === 'codex' && chip.state === 'out'
      ? (state.codexResetCredits?.availableCount ?? 0)
      : 0,
  );
  return (
    <FactCard card={limitsCardOf({ chip, nowMs, freeResets })} side="bottom" isOpen={isOpen}>
      {children}
    </FactCard>
  );
};

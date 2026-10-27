import { Chip, cn, ICON_SIZE } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import type { BranchRowChip as BranchRowChipView } from './branchRowChipOf';

type Props = {
  readonly chip: BranchRowChipView;
};

const CHIP_ICONS = {
  auto: CONCEPT_ICONS.auto,
  git: CONCEPT_ICONS.branch,
} as const;

export const BranchRowChip = ({ chip }: Props) => {
  const Icon = chip.icon === null ? null : CHIP_ICONS[chip.icon];
  return (
    <span
      data-chip-kind={chip.kind}
      data-is-breathing={chip.isBreathing ? '' : undefined}
      className={cn(
        'flex min-w-0 shrink-0 group-focus-within/row:invisible group-hover/row:invisible group-data-[row-opened]/row:invisible',
        chip.isBreathing && 'motion-safe:animate-soft-pulse',
      )}
    >
      <Chip
        kind="state"
        tone={chip.tone}
        label={chip.text}
        icon={Icon === null ? undefined : <Icon size={ICON_SIZE.mark} aria-hidden />}
        bordered={false}
        testId="branch-row-chip"
        className="max-w-32 truncate"
      />
    </span>
  );
};

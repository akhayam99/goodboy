import { CHIP_KEY_LABEL, type SearchChip } from '../../searchChips';
import type { SearchScope } from '../../searchScope';
import { SearchChipPill } from './SearchChipPill';

type Props = {
  readonly scope: SearchScope;
  readonly chips: ReadonlyArray<SearchChip>;
  readonly onWiden: () => void;
  readonly onRemoveChip: (index: number) => void;
};

const SCOPE_EYEBROW: Readonly<Record<SearchScope['kind'], string>> = {
  session: 'In session',
  workspace: 'In',
  all: 'Everywhere',
};

export const SearchChips = ({ scope, chips, onWiden, onRemoveChip }: Props) => {
  if (scope.kind === 'all' && chips.length === 0) {
    return null;
  }
  return (
    <div className="flex min-w-0 max-w-[60%] shrink items-center gap-2 overflow-hidden">
      {scope.kind === 'all' ? null : (
        <SearchChipPill
          eyebrow={SCOPE_EYEBROW[scope.kind]}
          label={scope.label}
          removeLabel="Search wider"
          onRemove={onWiden}
        />
      )}
      {chips.map((chip, index) => (
        <SearchChipPill
          key={`${chip.key}-${chip.label}`}
          eyebrow={CHIP_KEY_LABEL[chip.key]}
          label={chip.label}
          removeLabel={`Remove ${CHIP_KEY_LABEL[chip.key]} ${chip.label}`}
          onRemove={() => onRemoveChip(index)}
        />
      ))}
    </div>
  );
};

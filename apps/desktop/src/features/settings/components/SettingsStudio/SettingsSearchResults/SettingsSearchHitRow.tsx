import { FOCUS_RING, SelectableRow, cn } from '@goodboy/ui';

import type { SettingsSearchHit } from '../../../settingsSearchHits';

type Props = {
  readonly id: string;
  readonly hit: SettingsSearchHit;
  readonly isActive: boolean;
  readonly onPick: () => void;
};

const ROW = cn(FOCUS_RING, 'flex-col gap-0.5 px-2 py-1 motion-safe:transition-colors');

export const SettingsSearchHitRow = ({ id, hit, isActive, onPick }: Props) => (
  <SelectableRow
    id={id}
    role="option"
    selected={isActive}
    ariaSelected={isActive}
    tabIndex={-1}
    onClick={onPick}
    className={ROW}
  >
    <span className="min-w-0 truncate text-ui text-foreground">{hit.label}</span>
    {hit.place === null ? null : (
      <span className="min-w-0 truncate text-meta text-faint-foreground">{hit.place}</span>
    )}
  </SelectableRow>
);

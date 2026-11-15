import { EmptyLine, PANE_RHYTHM, cn } from '@goodboy/ui';

import { shortcutGlyphs } from '../../../../../shared/keyboard/registry';
import { settingsSearchHitId } from '../../../settingsSearchHitId';
import type { SettingsSearchHit } from '../../../settingsSearchHits';
import { SettingsSearchHitRow } from './SettingsSearchHitRow';

type PickParams = {
  readonly index: number;
};

type Props = {
  readonly listId: string;
  readonly query: string;
  readonly hits: ReadonlyArray<SettingsSearchHit>;
  readonly activeIndex: number;
  readonly onPick: (params: PickParams) => void;
};

export const SettingsSearchResults = ({ listId, query, hits, activeIndex, onPick }: Props) => {
  if (hits.length === 0) {
    return (
      <div className={cn('flex flex-col', PANE_RHYTHM.navRail.body)}>
        <EmptyLine className="px-2">
          {`No setting matches "${query.trim()}".`}
          <br />
          {`Actions like Export live in ${shortcutGlyphs('palette.open')}.`}
        </EmptyLine>
      </div>
    );
  }
  return (
    <div
      id={listId}
      role="listbox"
      aria-label="Matching settings"
      className={cn('flex flex-col gap-0.5', PANE_RHYTHM.navRail.body)}
    >
      {hits.map((hit, index) => (
        <SettingsSearchHitRow
          key={hit.key}
          id={settingsSearchHitId({ listId, index })}
          hit={hit}
          isActive={index === activeIndex}
          onPick={() => onPick({ index })}
        />
      ))}
    </div>
  );
};

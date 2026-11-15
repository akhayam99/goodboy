import { useMemo, useState, type KeyboardEvent } from 'react';
import { useEscapeLayer } from '@goodboy/ui';
import type { SettingsGroup } from '../../components/SettingsStudio/settingsDirectory';
import type { SettingsFocus } from '../../settingsFocus';
import { settingsSearchHits, type SettingsSearchHit } from '../../settingsSearchHits';

type Params = {
  readonly groups: ReadonlyArray<SettingsGroup>;
  readonly query: string;
  readonly onOpen: (focus: SettingsFocus) => void;
  readonly onClear: () => void;
};

type Active = {
  readonly query: string;
  readonly index: number;
};

type PickParams = {
  readonly index: number;
};

type MoveParams = {
  readonly step: number;
};

type KeyParams = {
  readonly event: KeyboardEvent<HTMLInputElement>;
};

export type SettingsSearch = {
  readonly hits: ReadonlyArray<SettingsSearchHit>;
  readonly activeIndex: number;
  readonly pick: (params: PickParams) => void;
  readonly keyDown: (params: KeyParams) => void;
};

export const useSettingsSearch = ({ groups, query, onOpen, onClear }: Params): SettingsSearch => {
  const hits = useMemo(
    () => settingsSearchHits({ groups, query, open: onOpen }),
    [groups, query, onOpen],
  );
  const [active, setActive] = useState<Active>({ query, index: 0 });
  const activeIndex = active.query === query ? Math.min(active.index, hits.length - 1) : 0;

  const pick = ({ index }: PickParams) => {
    const hit = hits[index];
    if (hit === undefined) {
      return;
    }
    onClear();
    hit.run();
  };

  const move = ({ step }: MoveParams) => {
    if (hits.length === 0) {
      return;
    }
    setActive({ query, index: Math.max(0, Math.min(hits.length - 1, activeIndex + step)) });
  };

  const keyDown = ({ event }: KeyParams) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      move({ step: 1 });
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      move({ step: -1 });
      return;
    }
    if (event.key === 'Enter' && hits.length > 0) {
      event.preventDefault();
      pick({ index: activeIndex });
    }
  };

  useEscapeLayer(onClear, query !== '');

  return { hits, activeIndex, pick, keyDown };
};

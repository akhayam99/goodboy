import { useMemo } from 'react';
import { useAppStore } from '../../../../store';
import { selectIsHomeShown } from '../../../../shared/navigation/selectIsHomeShown';
import type { PaletteEntry } from '../../../palette/types';
import { DEFAULT_HOME_ENTRIES } from '../../layout/defaultHomeLayout';
import { homePaletteEntries } from '../../layout/homePaletteEntries';
import { HOME_LAYOUT_KEY } from '../../layout/layoutTypes';
import { parseHomeLayout } from '../../layout/parseHomeLayout';

const NO_ENTRIES: ReadonlyArray<PaletteEntry> = [];

export const useHomePaletteEntries = (): ReadonlyArray<PaletteEntry> => {
  const isHomeShown = useAppStore((state) => selectIsHomeShown({ state }));
  const raw = useAppStore((state) =>
    state.currentWorkspaceId === null
      ? null
      : (state.workspaceValues[state.currentWorkspaceId]?.[HOME_LAYOUT_KEY] ?? null),
  );
  return useMemo(
    () =>
      isHomeShown
        ? homePaletteEntries({ entries: parseHomeLayout({ raw }) ?? DEFAULT_HOME_ENTRIES })
        : NO_ENTRIES,
    [isHomeShown, raw],
  );
};

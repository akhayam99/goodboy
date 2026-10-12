import type { HiddenPort, PinnedPort } from '@goodboy/core';
import { deleteSetting, getSetting, listSettingsWithPrefix, setSetting } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { parseHiddenPorts } from './parseHiddenPorts';
import { parsePinnedPorts } from './parsePinnedPorts';
import { parsePortList } from './parsePortList';
import { HIDDEN_PORTS_KEY, LEGACY_WATCHED_PORTS_PREFIX, PINNED_PORTS_KEY } from './settingKeys';

export type PinState = {
  readonly pinned: ReadonlyArray<PinnedPort>;
  readonly hidden: ReadonlyArray<HiddenPort>;
};

type LegacyEntry = {
  readonly key: string;
  readonly value: string;
};

type FoldParams = {
  readonly pinned: ReadonlyArray<PinnedPort>;
  readonly entries: ReadonlyArray<LegacyEntry>;
};

const foldLegacy = ({ pinned, entries }: FoldParams): ReadonlyArray<PinnedPort> => {
  const known = new Set(pinned.map((pin) => pin.port));
  const added: PinnedPort[] = [];
  for (const entry of entries) {
    for (const port of parsePortList({ raw: entry.value })) {
      if (known.has(port)) {
        continue;
      }
      known.add(port);
      added.push({ port, description: '' });
    }
  }
  return [...pinned, ...added].sort((a, b) => a.port - b.port);
};

export const loadPinnedPorts = async (): Promise<PinState> => {
  const [pinnedRaw, hiddenRaw, legacy] = await Promise.all([
    getSetting(tauriDatabase, PINNED_PORTS_KEY),
    getSetting(tauriDatabase, HIDDEN_PORTS_KEY),
    listSettingsWithPrefix(tauriDatabase, LEGACY_WATCHED_PORTS_PREFIX),
  ]);
  const stored = parsePinnedPorts({ raw: pinnedRaw });
  const hidden = parseHiddenPorts({ raw: hiddenRaw });
  if (legacy.length === 0) {
    return { pinned: stored, hidden };
  }
  const pinned = foldLegacy({ pinned: stored, entries: legacy });
  await setSetting(tauriDatabase, PINNED_PORTS_KEY, JSON.stringify(pinned));
  for (const entry of legacy) {
    await deleteSetting(tauriDatabase, entry.key);
  }
  return { pinned, hidden };
};

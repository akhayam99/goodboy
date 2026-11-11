import type { SessionId } from '@goodboy/types';
import type { BrowserTab } from '../../store/slices/browser/types';
import { hostOf } from './hostOf';
import { matchesWords } from './matchesWords';
import { shortAddressOf } from './shortAddressOf';
import type { BrowserPageGroup, CommandTabRow } from './types';

type TabParams = {
  readonly tab: BrowserTab;
};

type Params = {
  readonly words: ReadonlyArray<string>;
  readonly groups: ReadonlyArray<BrowserPageGroup>;
  readonly sessionId: SessionId;
  readonly titleOf: (params: TabParams) => string;
  readonly limit: number;
};

type GroupParams = {
  readonly group: BrowserPageGroup;
  readonly sessionId: SessionId;
};

const savedTitleOf = ({ tab }: TabParams): string =>
  tab.title === '' ? hostOf({ url: tab.url }) : tab.title;

const groupRankOf = ({ group, sessionId }: GroupParams): number => {
  if (group.sessionId === sessionId && !group.isPins) {
    return 0;
  }
  return group.isPins ? 1 : 2;
};

export const matchTabs = ({
  words,
  groups,
  sessionId,
  titleOf,
  limit,
}: Params): ReadonlyArray<CommandTabRow> => {
  if (words.length === 0) {
    return [];
  }
  const ordered = [...groups].sort(
    (left, right) =>
      groupRankOf({ group: left, sessionId }) - groupRankOf({ group: right, sessionId }),
  );
  const seen = new Set<string>();
  const rows: Array<CommandTabRow> = [];
  for (const group of ordered) {
    const isHere = group.sessionId === sessionId;
    for (const tab of group.tabs) {
      if (seen.has(tab.id)) {
        continue;
      }
      const title = isHere ? titleOf({ tab }) : savedTitleOf({ tab });
      const address = shortAddressOf({ url: tab.url });
      if (!matchesWords({ words, fields: [title, address] })) {
        continue;
      }
      seen.add(tab.id);
      rows.push({
        kind: 'tab',
        key: `tab:${tab.id}`,
        tab,
        sessionId: group.sessionId,
        title,
        address,
        place: group.isPins || isHere ? null : group.label,
        isPin: group.isPins,
        isHere,
      });
    }
  }
  return rows.slice(0, limit);
};

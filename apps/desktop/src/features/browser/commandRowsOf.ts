import type { SessionId } from '@goodboy/types';
import type { BrowserTab } from '../../store/slices/browser/types';
import type { BrowserVisit } from '../../store/slices/browser-visits/types';
import { addressOf } from './addressOf';
import { hostOf } from './hostOf';
import { matchTabs } from './matchTabs';
import { matchesWords } from './matchesWords';
import { shortAddressOf } from './shortAddressOf';
import type { BrowserPageGroup, CommandGroup, CommandRow, CommandRows } from './types';

type TabParams = {
  readonly tab: BrowserTab;
};

type Params = {
  readonly text: string;
  readonly groups: ReadonlyArray<BrowserPageGroup>;
  readonly visits: ReadonlyArray<BrowserVisit>;
  readonly sessionId: SessionId;
  readonly titleOf: (params: TabParams) => string;
};

type VisitParams = {
  readonly words: ReadonlyArray<string>;
  readonly visits: ReadonlyArray<BrowserVisit>;
  readonly skipped: ReadonlySet<string>;
};

const TAB_LIMIT = 6;
const VISIT_LIMIT = 20;
const TYPED_VISIT_LIMIT = 6;
const WHITESPACE = /\s+/;

const openRowsOf = ({ text }: Pick<Params, 'text'>): ReadonlyArray<CommandRow> => {
  const parsed = addressOf({ text });
  if (parsed.kind === 'refused') {
    return [];
  }
  const label = text.trim();
  if (parsed.kind === 'local') {
    return [{ kind: 'open', key: 'open', url: parsed.path, label }];
  }
  return [
    { kind: 'open', key: 'open', url: parsed.url, label },
    { kind: 'outside', key: 'outside', url: parsed.url, label },
  ];
};

const visitRowsOf = ({ words, visits, skipped }: VisitParams): ReadonlyArray<CommandRow> =>
  visits
    .filter((visit) => !skipped.has(visit.url))
    .map((visit) => ({
      kind: 'visit' as const,
      key: `visit:${visit.url}`,
      url: visit.url,
      title: visit.title === '' ? hostOf({ url: visit.url }) : visit.title,
      address: shortAddressOf({ url: visit.url }),
    }))
    .filter((row) => matchesWords({ words, fields: [row.title, row.address] }))
    .slice(0, words.length === 0 ? VISIT_LIMIT : TYPED_VISIT_LIMIT);

export const commandRowsOf = ({
  text,
  groups,
  visits,
  sessionId,
  titleOf,
}: Params): CommandRows => {
  const trimmed = text.trim();
  const words = trimmed === '' ? [] : trimmed.toLowerCase().split(WHITESPACE);
  const open = trimmed === '' ? [] : openRowsOf({ text: trimmed });
  const tabs = matchTabs({ words, groups, sessionId, titleOf, limit: TAB_LIMIT });
  const skipped = new Set(tabs.map((row) => row.tab.url));
  const visited = visitRowsOf({ words, visits, skipped });
  const listed: ReadonlyArray<CommandGroup> = [
    { key: 'open', label: 'Open', rows: open },
    { key: 'tabs', label: 'Tabs', rows: tabs },
    { key: 'visited', label: 'Visited', rows: visited },
  ];
  const shown = listed.filter((group) => group.rows.length > 0);
  return { groups: shown, hasNoMatch: trimmed !== '' && shown.length === 0 };
};

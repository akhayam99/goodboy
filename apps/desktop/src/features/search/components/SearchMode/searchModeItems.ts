import type { SearchHit } from '@goodboy/types';
import type { LookupHit } from '../../../integrations/issueCode/lookupIssueByCode';
import type { SearchModeItem } from './searchModeItem';

type Params = {
  readonly hits: ReadonlyArray<SearchHit>;
  readonly lookupHits: ReadonlyArray<LookupHit>;
};

export const searchModeItems = ({ hits, lookupHits }: Params): ReadonlyArray<SearchModeItem> => [
  ...lookupHits.map((hit): SearchModeItem => ({
    kind: 'lookup',
    id: `lookup:${hit.record.key}`,
    url: hit.record.url,
  })),
  ...hits.map((hit): SearchModeItem => ({ kind: 'result', id: hit.docId, hit })),
];

import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { openInBrowser } from '../../browser/openInBrowser';
import { typedAddressOf } from '../../browser/typedAddressOf';
import type { PaletteEntry } from '../types';

type Params = {
  readonly query: string;
  readonly sessionId: SessionId | null;
};

const BROWSER_OPEN_KEY = 'browser:open';

export const browserOpenEntries = ({ query, sessionId }: Params): ReadonlyArray<PaletteEntry> => {
  const url = typedAddressOf({ text: query });
  if (url === null) {
    return [];
  }
  return [
    {
      key: BROWSER_OPEN_KEY,
      label: `Open ${query.trim()}`,
      kind: 'action',
      group: null,
      icon: CONCEPT_ICONS.browser,
      detail: sessionId === null ? 'In your browser' : 'Beside this session',
      run: () => void openInBrowser({ sessionId, url }),
    },
  ];
};

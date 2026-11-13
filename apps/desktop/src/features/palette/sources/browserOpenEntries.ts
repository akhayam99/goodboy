import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { openBeside } from '../../browser/openBeside';
import { openInBrowser } from '../../browser/openInBrowser';
import { typedAddressOf } from '../../browser/typedAddressOf';
import { typedLocalPathOf } from '../../browser/typedLocalPathOf';
import type { PaletteEntry } from '../types';

type Params = {
  readonly query: string;
  readonly sessionId: SessionId | null;
};

const BROWSER_OPEN_KEY = 'browser:open';

export const browserOpenEntries = ({ query, sessionId }: Params): ReadonlyArray<PaletteEntry> => {
  const url = typedAddressOf({ text: query });
  const path = typedLocalPathOf({ text: query });
  const label = `Open ${query.trim()}`;
  if (url !== null) {
    return [
      {
        key: BROWSER_OPEN_KEY,
        label,
        kind: 'action',
        group: null,
        icon: CONCEPT_ICONS.browser,
        detail: sessionId === null ? 'In your browser' : 'Beside this session',
        run: () => void openInBrowser({ sessionId, url }),
      },
    ];
  }
  if (path === null || sessionId === null) {
    return [];
  }
  return [
    {
      key: BROWSER_OPEN_KEY,
      label,
      kind: 'action',
      group: null,
      icon: CONCEPT_ICONS.browser,
      detail: 'Beside this session',
      run: () => void openBeside({ sessionId, target: { kind: 'local', path } }),
    },
  ];
};

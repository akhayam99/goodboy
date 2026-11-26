import type { MonitorProcess, PortRow } from '@goodboy/core/monitoring';
import type { SessionId } from '@goodboy/types';
import { originOf } from './originOf';
import { sourceFileOf } from './sourceFileOf';
import type { BrowserPickedElement } from './types';

type Params = {
  readonly element: BrowserPickedElement;
  readonly sessionId: SessionId;
  readonly rows: ReadonlyArray<PortRow>;
  readonly processes: ReadonlyArray<MonitorProcess>;
};

export const elementFileOf = ({ element, sessionId, rows, processes }: Params): string | null => {
  const { source } = element;
  const origin = originOf({ url: element.url });
  if (source === null || origin === null) {
    return null;
  }
  const path = source.path.startsWith('/') ? source.path : `/${source.path}`;
  return sourceFileOf({ url: `${origin}${path}`, line: source.line, sessionId, rows, processes });
};

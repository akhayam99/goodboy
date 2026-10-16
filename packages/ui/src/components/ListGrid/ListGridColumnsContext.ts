import { createContext } from 'react';
import type { ListGridColumn } from './listGridTemplate';

export type FilledReport = {
  readonly rowId: string;
  readonly keys: ReadonlyArray<string> | null;
};

export type ListGridColumnsValue = {
  readonly columns: ReadonlyArray<ListGridColumn>;
  readonly hiddenKeys: ReadonlySet<string>;
  readonly hasHideable: boolean;
  readonly reportFilled: (report: FilledReport) => void;
};

const NO_KEYS: ReadonlySet<string> = new Set();

export const ListGridColumnsContext = createContext<ListGridColumnsValue>({
  columns: [],
  hiddenKeys: NO_KEYS,
  hasHideable: false,
  reportFilled: () => undefined,
});

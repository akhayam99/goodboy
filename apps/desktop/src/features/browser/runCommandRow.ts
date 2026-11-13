import { useAppStore } from '../../store';
import { openUrl } from '../../shared/lib/editor';
import { addressOf } from './addressOf';
import { showBrowser } from './showBrowser';
import { showBrowserTab } from './showBrowserTab';
import type { BrowserPaneModel, CommandRow, CommandTabRow } from './types';

type Params = {
  readonly row: CommandRow;
  readonly isAlternate: boolean;
  readonly model: BrowserPaneModel;
  readonly onDone: () => void;
};

type TabParams = {
  readonly row: CommandTabRow;
  readonly model: BrowserPaneModel;
};

type RowParams = {
  readonly row: CommandRow;
};

const urlOf = ({ row }: RowParams): string => (row.kind === 'tab' ? row.tab.url : row.url);

const showTab = ({ row, model }: TabParams): void => {
  if (row.isHere) {
    model.select({ tab: row.tab });
    return;
  }
  if (row.isPin) {
    useAppStore.getState().showBrowserPin({ sessionId: row.sessionId, tabId: row.tab.id });
    showBrowser({ sessionId: row.sessionId });
    return;
  }
  showBrowserTab({ sessionId: row.sessionId, tabId: row.tab.id });
};

export const runCommandRow = async ({ row, isAlternate, model, onDone }: Params): Promise<void> => {
  const url = urlOf({ row });
  const isLocal = addressOf({ text: url }).kind === 'local';
  if (row.kind === 'outside' || (isAlternate && !isLocal)) {
    onDone();
    await openUrl(url).catch((failure: unknown) => model.showError({ error: failure }));
    return;
  }
  if (row.kind === 'tab') {
    showTab({ row, model });
    onDone();
    return;
  }
  const isDone = await model.submit({ text: row.url });
  if (isDone) {
    onDone();
  }
};

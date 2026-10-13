import type { TerminalOwner, TerminalTab, TerminalTabId } from '../../../shared/types/terminal';
import { terminalOwnerKey } from './terminalOwner';
import type { SliceDeps } from '../../slice-types';

type Params = Pick<SliceDeps, 'set'>;

type PrefillParams = {
  readonly owner: TerminalOwner;
  readonly tabId: TerminalTabId;
  readonly prefill: string | null;
};

type WithPrefillParams = {
  readonly tab: TerminalTab;
  readonly prefill: string | null;
};

const withPrefill = ({ tab, prefill }: WithPrefillParams): TerminalTab => {
  const { prefill: _dropped, ...rest } = tab;
  return prefill === null ? rest : { ...rest, prefill };
};

export const setTerminalPrefill = ({ set }: Params) => {
  return ({ owner, tabId, prefill }: PrefillParams): void => {
    const key = terminalOwnerKey({ owner });
    set((s) => ({
      terminalTabs: {
        ...s.terminalTabs,
        [key]: (s.terminalTabs[key] ?? []).map((tab) =>
          tab.id === tabId ? withPrefill({ tab, prefill }) : tab,
        ),
      },
    }));
  };
};

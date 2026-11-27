import { capitalized } from '../../../../shared/utils/capitalized';
import type { BridgeFault, PairedPhone } from '../../bridge';
import type { LinkState } from '../../linkOf';
import { permissionsTextOf } from '../../permissionsTextOf';
import { phoneStateTextOf } from '../../phoneStateTextOf';
import { phoneSyncTextOf } from '../../phoneSyncTextOf';
import { entryToneOf, type EntryTone } from './entryToneOf';
import { faultStateOf } from './faultStateOf';

export type FactRow = {
  readonly label: string;
  readonly text: string;
  readonly tone: EntryTone | null;
};

type Params = {
  readonly state: LinkState;
  readonly phone: PairedPhone;
  readonly fault: BridgeFault | null;
  readonly now: number;
};

export const factRowsOf = ({ state, phone, fault, now }: Params): ReadonlyArray<FactRow> => {
  const stateText =
    state === 'fault' && fault !== null
      ? faultStateOf({ fault })
      : phoneStateTextOf({ phone, now, isFaulted: false });
  return [
    { label: 'State', text: stateText, tone: entryToneOf({ state }) },
    {
      label: 'Last sync',
      text: capitalized({ text: phoneSyncTextOf({ phone, now }) }),
      tone: null,
    },
    { label: 'Rights', text: permissionsTextOf({ permissions: phone.permissions }), tone: null },
  ];
};

import { Fragment } from 'react';
import { ICON_SIZE, PopoverPin, SelectableRow, StatusMark } from '@goodboy/ui';
import { Settings } from '@goodboy/ui/icons';
import type { BridgeFault, PairedPhone } from '../../bridge';
import type { LinkState } from '../../linkOf';
import { factRowsOf } from './factRowsOf';

type Props = {
  readonly state: LinkState;
  readonly phone: PairedPhone;
  readonly fault: BridgeFault | null;
  readonly now: number;
  readonly onOpenSettings: () => void;
};

export const EntryFacts = ({ state, phone, fault, now, onOpenSettings }: Props) => (
  <>
    <div className="flex flex-col gap-2 p-3">
      <span className="text-heading text-foreground">
        {state === 'fault' ? "Pairing isn't available" : phone.name}
      </span>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-meta">
        {factRowsOf({ state, phone, fault, now }).map(({ label, text, tone }) => (
          <Fragment key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="flex items-center gap-2 text-foreground">
              {tone === null ? null : <StatusMark mark={{ kind: 'dot', tone }} />}
              {text}
            </dd>
          </Fragment>
        ))}
      </dl>
    </div>
    <PopoverPin edge="end" className="p-1">
      <SelectableRow
        selected={false}
        onClick={onOpenSettings}
        className="h-8 items-center gap-2 px-2 text-ui"
      >
        <Settings size={ICON_SIZE.row} aria-hidden className="shrink-0 text-muted-foreground" />
        <span className="flex-1">Open iPhone settings</span>
      </SelectableRow>
    </PopoverPin>
  </>
);

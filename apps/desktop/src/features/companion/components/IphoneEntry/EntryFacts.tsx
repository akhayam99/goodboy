import { Fragment } from 'react';
import { Button, Divider, ICON_SIZE, StatusMark } from '@goodboy/ui';
import { Settings } from '@goodboy/ui/icons';
import type { BridgeFault, PairedPhone } from '../../bridge';
import { permissionsTextOf } from '../../permissionsTextOf';
import { phoneStateLineOf } from '../../phoneStateLineOf';
import type { LinkState } from '../../linkOf';
import { entryToneOf } from './entryToneOf';

type Props = {
  readonly state: LinkState;
  readonly phone: PairedPhone | null;
  readonly fault: BridgeFault | null;
  readonly now: number;
  readonly onOpenSettings: () => void;
};

type Fact = {
  readonly label: string;
  readonly text: string;
};

type FactsParams = {
  readonly phone: PairedPhone | null;
  readonly fault: BridgeFault | null;
  readonly now: number;
};

const factsOf = ({ phone, fault, now }: FactsParams): ReadonlyArray<Fact> => {
  const facts: Array<Fact> = [];
  if (fault !== null) {
    facts.push({ label: 'Problem', text: fault.message });
  }
  if (phone !== null) {
    facts.push(
      { label: 'State', text: phoneStateLineOf({ phone, now }) },
      { label: 'Rights', text: permissionsTextOf({ permissions: phone.permissions }) },
    );
  }
  return facts;
};

export const EntryFacts = ({ state, phone, fault, now, onOpenSettings }: Props) => {
  const tone = entryToneOf({ state });
  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="flex flex-col gap-2 px-2 pt-1">
        <div className="flex items-center gap-2">
          {tone === null ? null : <StatusMark mark={{ kind: 'dot', tone }} />}
          <span className="text-row text-foreground">{phone === null ? 'iPhone' : phone.name}</span>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          {factsOf({ phone, fault, now }).map(({ label, text }) => (
            <Fragment key={label}>
              <dt className="text-meta text-muted-foreground">{label}</dt>
              <dd className="text-ui text-foreground">{text}</dd>
            </Fragment>
          ))}
        </dl>
      </div>
      <Divider />
      <Button variant="ghost" size="sm" className="justify-start" onClick={onOpenSettings}>
        <Settings size={ICON_SIZE.row} aria-hidden /> Open iPhone settings
      </Button>
    </div>
  );
};

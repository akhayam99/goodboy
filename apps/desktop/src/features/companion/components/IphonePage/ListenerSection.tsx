import { SectionLabel } from '@goodboy/ui';
import type { BridgeStatus, NetworkInterface } from '../../bridge';
import { NetworkChoice } from './NetworkChoice';

type ToggleParams = {
  readonly name: string;
  readonly isSelected: boolean;
};

type Props = {
  readonly status: BridgeStatus | null;
  readonly interfaces: ReadonlyArray<NetworkInterface>;
  readonly isBusy: boolean;
  readonly onToggle: (params: ToggleParams) => Promise<void>;
};

type SentenceParams = {
  readonly status: BridgeStatus | null;
};

const sentenceOf = ({ status }: SentenceParams): string => {
  const parts = ['Goodboy listens only on the networks you switch on.'];
  if (status !== null && status.isAdvertised) {
    parts.push('Bonjour is on.');
  }
  if (status !== null && status.port !== null) {
    parts.push(`Port ${status.port}.`);
  }
  parts.push('Public addresses are never offered.');
  return parts.join(' ');
};

export const ListenerSection = ({ status, interfaces, isBusy, onToggle }: Props) => (
  <section aria-label="Listener" className="flex flex-col gap-3">
    <SectionLabel label="Listener" headingLevel={2} />
    <p className="text-ui text-muted-foreground">{sentenceOf({ status })}</p>
    <NetworkChoice interfaces={interfaces} isBusy={isBusy} onToggle={onToggle} />
  </section>
);

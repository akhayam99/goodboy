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
  readonly isFaulted: boolean;
  readonly isBusy: boolean;
  readonly onToggle: (params: ToggleParams) => Promise<void>;
};

type SentenceParams = {
  readonly status: BridgeStatus | null;
  readonly isFaulted: boolean;
};

const listenerSentenceOf = ({ status, isFaulted }: SentenceParams): string => {
  if (isFaulted) {
    return 'Not listening until pairing is reset.';
  }
  const parts = ['Goodboy listens only on the networks you switch on.'];
  if (status !== null && status.isAdvertised) {
    parts.push('Bonjour is on.');
  }
  if (status !== null && status.port !== null) {
    parts.push(`Port ${status.port}.`);
  }
  return parts.join(' ');
};

export const ListenerSection = ({ status, interfaces, isFaulted, isBusy, onToggle }: Props) => (
  <section aria-label="Listener" className="flex flex-col gap-2">
    <SectionLabel label="Listener" headingLevel={2} />
    <p className="text-meta text-muted-foreground">{listenerSentenceOf({ status, isFaulted })}</p>
    <NetworkChoice interfaces={interfaces} isBusy={isBusy} onToggle={onToggle} />
  </section>
);

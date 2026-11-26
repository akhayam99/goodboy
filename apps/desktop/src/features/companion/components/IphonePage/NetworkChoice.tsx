import { EmptyLine, Switch } from '@goodboy/ui';

import type { NetworkInterface } from '../../bridge';

type ToggleParams = {
  readonly name: string;
  readonly isSelected: boolean;
};

type Props = {
  readonly interfaces: ReadonlyArray<NetworkInterface>;
  readonly isBusy: boolean;
  readonly onToggle: (params: ToggleParams) => Promise<void>;
};

export const NetworkChoice = ({ interfaces, isBusy, onToggle }: Props) => {
  if (interfaces.length === 0) {
    return (
      <EmptyLine>
        No private network is on. Connect to Wi-Fi, Ethernet or a VPN such as Tailscale.
      </EmptyLine>
    );
  }
  return (
    <div className="flex w-full flex-col gap-2">
      <p className="text-meta text-muted-foreground">
        The code offers only the networks you switch on, and Goodboy listens only on them. Public
        addresses are never offered.
      </p>
      {interfaces.map((net) => (
        <Switch
          key={net.name}
          label={`${net.name}: ${net.addresses.join(', ')}`}
          ariaLabel={`Offer ${net.name}`}
          checked={net.isSelected}
          disabled={isBusy}
          onChange={(isOn) => void onToggle({ name: net.name, isSelected: isOn })}
        />
      ))}
    </div>
  );
};

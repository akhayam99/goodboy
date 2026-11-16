import type { ProviderId } from '@goodboy/types';
import { ICON_SIZE } from '@goodboy/ui';
import { ProviderIcon } from '../components/ProviderIcon';

type Props = {
  readonly providerId: ProviderId;
  readonly label: string;
};

export const ProviderTitle = ({ providerId, label }: Props) => (
  <span className="flex min-w-0 items-center gap-2">
    <span
      aria-hidden
      className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border-soft bg-elevated"
    >
      <ProviderIcon provider={providerId} size={ICON_SIZE.hero} />
    </span>
    <span className="min-w-0 truncate">{label}</span>
  </span>
);

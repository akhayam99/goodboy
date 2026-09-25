import type { ProviderId } from '@goodboy/types';
import { CliGateLine } from '../../../../providers/components/CliGateLine';
import { useCliGate } from '../../../../providers/hooks/useCliGate';
import { openProviderCliUpdate } from '../../../../providers/openProviderCliUpdate';

type Props = {
  readonly provider: ProviderId;
  readonly modelId: string;
};

export const ComposerCliGate = ({ provider, modelId }: Props) => {
  const gate = useCliGate({ provider, modelId });
  if (gate === null) {
    return null;
  }
  return (
    <CliGateLine
      gate={gate}
      onUpdate={() => openProviderCliUpdate({ providerId: gate.provider })}
      className="px-3 pt-2"
    />
  );
};

import type { Agent, ProviderConnectionState, Session } from '@goodboy/types';
import { Button } from '@goodboy/ui';
import { NAMES } from '../../../../../../shared/utils/names';
import { useAppStore } from '../../../../../../store';
import { openProviderConnect } from '../../../../../providers/openProviderConnect';
import { PROVIDER_LABEL } from '../../../../../providers/providerLabel';
import { useAgentStoppedCopy } from '../../../AgentDetailPane/useAgentStoppedCopy';

type Props = {
  readonly session: Session;
  readonly agent: Agent;
  readonly isBusy: boolean;
  readonly onPress: () => void;
};

export const RunContinueVerb = ({ session, agent, isBusy, onPress }: Props) => {
  const { copy, provider } = useAgentStoppedCopy({
    session,
    agent,
    isAutoChild: false,
    isRunStep: false,
  });
  const connection = useAppStore(
    (state): ProviderConnectionState =>
      state.providers.find((candidate) => candidate.id === provider)?.connection ?? 'unknown',
  );
  if (copy.canContinue) {
    return (
      <Button variant="quiet" size="xs" isBusy={isBusy} onClick={onPress}>
        {NAMES.continue}
      </Button>
    );
  }
  return (
    <Button
      variant="quiet"
      size="xs"
      aria-label={`Connect ${PROVIDER_LABEL[provider]}`}
      onClick={() => openProviderConnect({ providerId: provider, connection })}
    >
      Connect
    </Button>
  );
};

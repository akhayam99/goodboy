import { CircleStop } from 'lucide-react';
import type { Agent, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { ConfirmableButton } from '../../../../shared/components/ConfirmableButton';
import type { ResolverStatus } from '../../resolver-linkage';
import { canForceCloseResolver } from './canForceCloseResolver';

type Props = {
  readonly agent: Agent;
  readonly sessionId: SessionId;
  readonly status: ResolverStatus;
};

export const ForceCloseResolverAction = ({ agent, sessionId, status }: Props) => {
  const forceCloseResolver = useAppStore((state) => state.forceCloseResolver);

  if (!canForceCloseResolver({ agent, status })) {
    return null;
  }

  const onConfirm = async () => {
    await forceCloseResolver(sessionId, agent.id);
  };

  return (
    <ConfirmableButton
      key={agent.id}
      label="Force close"
      armedLabel="Confirm stop"
      busyLabel="Stopping..."
      onConfirm={onConfirm}
      tone="danger"
      title="stop this resolver now and let the next queued one run"
      icon={<CircleStop size={9} aria-hidden />}
    />
  );
};

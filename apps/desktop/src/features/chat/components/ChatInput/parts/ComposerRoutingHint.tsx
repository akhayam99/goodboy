import type { Session } from '@goodboy/types';
import { RoutingIndicator } from '../../RoutingIndicator';
import type { useTurnRouting } from '../hooks/useTurnRouting';

type Props = {
  readonly session: Session;
  readonly routing: ReturnType<typeof useTurnRouting>;
  readonly isShown: boolean;
  readonly onSendAnyway: (() => void) | undefined;
};

export const ComposerRoutingHint = ({ session, routing, isShown, onSendAnyway }: Props) =>
  isShown ? (
    <RoutingIndicator
      sessionPreference={session.providerPreference}
      turnOverride={routing.routingOverride}
      connectedProviders={routing.connectedProviderIds}
      onSendAnyway={onSendAnyway}
    />
  ) : null;

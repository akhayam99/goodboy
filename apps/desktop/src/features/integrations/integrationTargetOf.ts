import type { WorkspaceId } from '@goodboy/types';
import type { IntegrationActionTarget } from '../actions/types';
import type { IntegrationGlyphProvider } from '../../shared/components/IntegrationGlyph';
import { integrationLabel } from '../../shared/utils/integrationLabel';
import { dispatchWindowEvent } from '../../shared/lib/dispatchWindowEvent';
import { disconnectDescriptionOf } from './disconnectDescriptionOf';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly provider: IntegrationGlyphProvider;
  readonly isConnected: boolean;
  readonly onCheck: () => Promise<void>;
  readonly onDisconnect: () => Promise<void>;
};

export const integrationTargetOf = ({
  workspaceId,
  provider,
  isConnected,
  onCheck,
  onDisconnect,
}: Params): IntegrationActionTarget => {
  const label = integrationLabel({ provider });
  if (!isConnected) {
    return {
      kind: 'integration',
      facts: {
        label,
        disconnectDescription: '',
        onOpenTasks: null,
        onCheck: null,
        onDisconnect: null,
      },
    };
  }
  const onOpenTasks = () =>
    dispatchWindowEvent({ name: 'goodboy:open-inbox', detail: { provider, workspaceId } });
  return {
    kind: 'integration',
    facts: {
      label,
      disconnectDescription: provider === 'github' ? '' : disconnectDescriptionOf({ provider }),
      onOpenTasks,
      onCheck,
      onDisconnect: provider === 'github' ? null : onDisconnect,
    },
  };
};

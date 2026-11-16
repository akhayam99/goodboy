import type { IntegrationCredentialId } from '@goodboy/types';
import type { AppStore } from '../../store';
import type { IntegrationKeyCheck } from './state';

type Params = {
  readonly state: Pick<AppStore, 'integrationKeyChecks'>;
  readonly credentialId: IntegrationCredentialId | null;
};

export const selectIntegrationKeyCheck = ({
  state,
  credentialId,
}: Params): IntegrationKeyCheck | null =>
  credentialId === null ? null : (state.integrationKeyChecks[credentialId] ?? null);

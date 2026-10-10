import { PROVIDER_LABEL } from './providerLabel';
import type { ProviderId } from '@goodboy/types';
import {
  REFUSALS_TO_OPEN_BREAKER,
  type ProviderHealth,
} from '../../store/slices/providers/providerHealth';
import { formatAge } from '../../shared/utils/time/formatAge';

type ProviderParams = {
  readonly providerId: ProviderId;
};

type AgeParams = {
  readonly health: ProviderHealth;
  readonly nowMs: number;
};

type ConfirmationParams = ProviderParams &
  AgeParams & {
    readonly identity: string | null;
  };

export const confirmationLine = ({
  providerId,
  health,
  nowMs,
  identity,
}: ConfirmationParams): string | null => {
  if (health.standing !== 'connected') {
    return null;
  }
  if (!health.evidence.serverAccepted) {
    return `Signed in on this Mac. Not confirmed by ${PROVIDER_LABEL[providerId]}.`;
  }
  const age = formatAge({ from: health.evidence.lastGoodAt, now: nowMs });
  const confirmed = age === '' ? 'Confirmed' : `Confirmed ${age}`;
  return identity === null ? confirmed : `Signed in as ${identity}. ${confirmed}`;
};

export const cannotCheckTitle = ({ providerId }: ProviderParams): string =>
  `Can't reach ${PROVIDER_LABEL[providerId]} right now`;

export const cannotCheckBody = ({ health, nowMs }: AgeParams): string => {
  const age = formatAge({ from: health.evidence.lastGoodAt, now: nowMs });
  return age === '' ? 'Nothing confirmed yet.' : `Showing what we last knew, from ${age}.`;
};

export const breakerTitle = ({
  providerId,
  health,
}: ProviderParams & Pick<AgeParams, 'health'>): string =>
  `${PROVIDER_LABEL[providerId]} refused your last ${Math.max(REFUSALS_TO_OPEN_BREAKER, health.refusals.length)} runs`;

export const breakerBody = ({ providerId }: ProviderParams): string =>
  `${PROVIDER_LABEL[providerId]} says you are signed in on this Mac, but it did not accept the runs.`;

import { useEffect, useState, type ComponentType } from 'react';
import type { ProviderId } from '@goodboy/types';
import type { ProviderDisplayInfo } from '../../../../../features/providers/providers';
import { useAppStore } from '../../../../../store';
import {
  INITIAL_EVIDENCE,
  INITIAL_HEALTH,
  INITIAL_HEALTH_MAP,
  type ProviderHealth,
} from '../../../../../store/slices/providers/providerHealth';
import { sceneClock } from '../../sceneClock';
import { AppFrame } from '../audit/AppFrame';
import { seedFrame } from '../audit/frameSeed';
import { installSettingsInvokeMocks } from '../audit/installSettingsInvokeMocks';
import { sceneParam } from '../audit/sceneParams';

const OPEN_DELAY_MS = 30;

const clock = sceneClock({ anchor: '2026-10-10T10:00:00.000Z' });

const CAPABILITIES = {
  models: [],
  supportsTools: true,
  supportsStream: true,
  supportsCheapModel: true,
};

const LAST_GOOD_AT = clock.ms({ at: '2026-10-10T09:58:00.000Z' });

const REFUSALS = [
  clock.ms({ at: '2026-10-10T09:55:00.000Z' }),
  clock.ms({ at: '2026-10-10T09:56:00.000Z' }),
  clock.ms({ at: '2026-10-10T09:57:00.000Z' }),
];

type StandingState = 'confirmed' | 'local' | 'cannotcheck' | 'breaker';

const STATES: ReadonlyArray<StandingState> = ['confirmed', 'local', 'cannotcheck', 'breaker'];

const isStandingState = (value: string | null): value is StandingState =>
  STATES.some((state) => state === value);

const CONFIRMED: ProviderHealth = {
  ...INITIAL_HEALTH,
  standing: 'connected',
  identity: 'mara.quint@harborline.dev',
  evidence: {
    ...INITIAL_EVIDENCE,
    localTokens: true,
    serverAccepted: true,
    lastProbeAt: LAST_GOOD_AT,
    lastProbeOutcome: 'good',
    lastGoodAt: LAST_GOOD_AT,
  },
};

const HEALTH_BY_STATE: Readonly<Record<StandingState, ProviderHealth>> = {
  confirmed: CONFIRMED,
  local: {
    ...CONFIRMED,
    evidence: { ...CONFIRMED.evidence, serverAccepted: false },
  },
  cannotcheck: {
    ...CONFIRMED,
    standing: 'cannot_check',
    evidence: { ...CONFIRMED.evidence, lastProbeOutcome: 'no_answer' },
  },
  breaker: {
    ...CONFIRMED,
    isBreakerOpen: true,
    refusals: REFUSALS,
    lastRefusal: 'Authentication required. Run `cursor-agent login` and try again.',
    evidence: { ...CONFIRMED.evidence, lastRunOutcome: 'refused', lastRunAt: REFUSALS[2] ?? null },
  },
};

type ProviderParams = {
  readonly id: ProviderId;
  readonly label: string;
  readonly binary: string;
  readonly health: ProviderHealth;
};

const provider = ({ id, label, binary, health }: ProviderParams): ProviderDisplayInfo => ({
  id,
  binary,
  capabilities: CAPABILITIES,
  connection: 'connected',
  version: '2.1.290',
  identity: 'mara.quint@harborline.dev',
  label,
  error: null,
  docsUrl: '',
  standing: health.standing,
  isBreakerOpen: health.isBreakerOpen,
});

type SeedParams = {
  readonly state: StandingState;
};

const seedProviderPage = ({ state }: SeedParams): void => {
  const cursor = HEALTH_BY_STATE[state];
  useAppStore.setState({
    providers: [
      provider({ id: 'anthropic', label: 'Claude', binary: 'claude', health: CONFIRMED }),
      provider({ id: 'cursor', label: 'Cursor', binary: 'cursor-agent', health: cursor }),
    ],
    providerHealth: { ...INITIAL_HEALTH_MAP, anthropic: CONFIRMED, cursor },
    authResults: {
      anthropic: { state: 'connected', identity: 'mara.quint@harborline.dev' },
      cursor: {
        state: 'connected',
        identity: 'mara.quint@harborline.dev',
        verified: state !== 'local',
      },
    },
    refreshProviders: async () => undefined,
  });
};

const ProviderHealthOverApp = () => {
  const [isReady, setIsReady] = useState(false);
  const requested = sceneParam({ key: 'state' });
  const state: StandingState = isStandingState(requested) ? requested : 'confirmed';

  useEffect(() => {
    installSettingsInvokeMocks();
    seedFrame({ context: 'session' });
    seedProviderPage({ state });
    setIsReady(true);
  }, [state]);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    const id = window.setTimeout(
      () =>
        useAppStore.getState().switchStudio({
          studio: { kind: 'settings', focus: { scope: 'providers', provider: 'cursor' } },
        }),
      OPEN_DELAY_MS,
    );
    return () => window.clearTimeout(id);
  }, [isReady]);

  if (!isReady) {
    return null;
  }
  return <AppFrame view="settings-over-app" isRailCollapsed={false} />;
};

export const U24_P_STANDING_SCENES: Readonly<Record<string, ComponentType>> = {
  providerhealth: ProviderHealthOverApp,
};

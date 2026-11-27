import { useEffect } from 'react';
import type { ConnectionsFocus } from '../../../../../../features/connections/connectionsFocus';
import { ConnectionsFrame } from '../../audit/ConnectionsFrame';
import { payloadString } from '../../audit/ipcPayload';
import { seedBrandSettings } from '../../brand/settingsBrandSeed';
import { mockSceneIpc } from '../../mockSceneIpc';
import { useAppStore } from '../../../../../../store';
import {
  INITIAL_EVIDENCE,
  INITIAL_HEALTH,
  INITIAL_HEALTH_MAP,
} from '../../../../../../store/slices/providers/providerHealth';

const MINUTE_MS = 60_000;
const DRIVE_AFTER_MS = 1_200;
const MISSING_KEY = 'mock-brand-cred-linear';
const CURRENT_CODEX_VERSION = '0.171.0';
const CODEX_PAGE: ConnectionsFocus = { kind: 'provider', provider: 'codex' };
const LINEAR_PAGE: ConnectionsFocus = { kind: 'tool', tool: 'linear' };

const seedHealth = (): void => {
  seedBrandSettings();
  const state = useAppStore.getState();
  const codexLimits = state.providerLimits.codex;
  useAppStore.setState({
    providers: state.providers.map((provider) =>
      provider.id === 'codex' ? { ...provider, version: CURRENT_CODEX_VERSION } : provider,
    ),
    providerLimits:
      codexLimits === undefined
        ? state.providerLimits
        : {
            ...state.providerLimits,
            codex: {
              ...codexLimits,
              status: 'reached',
              windows: codexLimits.windows.map((window) =>
                window.kind === 'fiveHour'
                  ? { ...window, status: 'reached', usedFraction: 1 }
                  : window,
              ),
            },
          },
    providerHealth: {
      ...INITIAL_HEALTH_MAP,
      codex: {
        ...INITIAL_HEALTH,
        standing: 'connected',
        evidence: {
          ...INITIAL_EVIDENCE,
          serverAccepted: true,
          localTokens: true,
          lastGoodAt: Date.now() - 3 * MINUTE_MS,
        },
      },
    },
  });
  mockSceneIpc((command, payload) => {
    if (command === 'integration_credential_has_secret') {
      return payloadString({ payload, key: 'credentialId' }) !== MISSING_KEY;
    }
    return undefined;
  });
};

type Props = {
  readonly menuLabel: string | null;
  readonly regionLabel: string | null;
};

const Drive = ({ menuLabel, regionLabel }: Props) => {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (menuLabel !== null) {
        document.querySelector<HTMLButtonElement>(`button[aria-label="${menuLabel}"]`)?.click();
      }
      if (regionLabel !== null) {
        document
          .querySelector(`[aria-label="${regionLabel}"]`)
          ?.scrollIntoView({ block: 'center' });
      }
    }, DRIVE_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [menuLabel, regionLabel]);
  return null;
};

export const U26S_HEALTH_SCENES = {
  'u26s-health-codexmenu': () => (
    <>
      <ConnectionsFrame focus={CODEX_PAGE} seed={seedHealth} />
      <Drive menuLabel="More Codex actions" regionLabel={null} />
    </>
  ),
  'u26s-health-codexaccount': () => (
    <>
      <ConnectionsFrame focus={CODEX_PAGE} seed={seedHealth} />
      <Drive menuLabel={null} regionLabel="Account" />
    </>
  ),
  'u26s-health-linear': () => <ConnectionsFrame focus={LINEAR_PAGE} seed={seedHealth} />,
};

import { useEffect, useState } from 'react';
import { useAppStore } from '../../../../../../store/store';
import {
  INITIAL_HEALTH,
  INITIAL_HEALTH_MAP,
} from '../../../../../../store/slices/providers/providerHealth';
import type { ProviderDisplayInfo } from '../../../../../../features/providers/providers';
import { sceneClock } from '../../../sceneClock';
import { AppFrame } from '../../audit/AppFrame';
import { seedFrame } from '../../audit/frameSeed';
import { installSettingsInvokeMocks } from '../../audit/installSettingsInvokeMocks';
import { sceneParam } from '../../audit/sceneParams';

const clock = sceneClock({ anchor: '2026-10-10T10:00:00.000Z' });
const provider: ProviderDisplayInfo = {
  id: 'cursor',
  label: 'Cursor',
  binary: 'cursor-agent',
  connection: 'connected',
  version: '2026.09.17',
  identity: 'mara@harborline.test',
  error: null,
  docsUrl: '',
  capabilities: { models: [], supportsTools: true, supportsStream: true, supportsCheapModel: true },
};

export const ProviderTestScene = () => {
  const [isReady, setIsReady] = useState(false);
  const scene = sceneParam({ key: 'scene' });
  useEffect(() => {
    installSettingsInvokeMocks();
    seedFrame({ context: 'session' });
    const at = clock.ms({ at: '2026-10-10T09:59:00.000Z' });
    const health = {
      ...INITIAL_HEALTH,
      standing: 'connected' as const,
      evidence: {
        ...INITIAL_HEALTH.evidence,
        localTokens: true,
        serverAccepted: true,
        lastGoodAt: at,
      },
      events: [
        {
          at: clock.ms({ at: '2026-10-10T09:55:00.000Z' }),
          from: 'unknown' as const,
          to: 'connected' as const,
          reason: 'probe confirmed',
        },
        {
          at: clock.ms({ at: '2026-10-10T09:57:00.000Z' }),
          from: 'connected' as const,
          to: 'cannot_check' as const,
          reason: 'Probe timed out',
        },
        {
          at,
          from: 'cannot_check' as const,
          to: 'connected' as const,
          reason: 'Test connection passed',
        },
      ],
    };
    useAppStore.setState({
      providers: [provider],
      providerHealth: { ...INITIAL_HEALTH_MAP, cursor: health },
      authResults: { cursor: { state: 'connected', identity: provider.identity } },
      providerConnectionTests: {
        cursor: {
          isTesting: false,
          result:
            scene === 'providertest-refused'
              ? { isOk: false, millis: 80, detail: 'Not logged in. Sign in again' }
              : { isOk: true, millis: 800, detail: 'Models answered' },
        },
      },
      refreshProviders: async () => undefined,
    });
    setIsReady(true);
    const open = window.setTimeout(() => {
      useAppStore.getState().switchStudio({
        studio: { kind: 'settings', focus: { scope: 'providers', provider: 'cursor' } },
      });
    }, 30);
    const history = window.setTimeout(() => {
      if (scene !== 'providerhistory') {
        return;
      }
      const trigger = Array.from(document.querySelectorAll('button')).find(
        (button) => button.textContent === 'History',
      );
      trigger?.click();
    }, 500);
    return () => {
      window.clearTimeout(open);
      window.clearTimeout(history);
    };
  }, [scene]);
  if (!isReady) {
    return null;
  }
  return <AppFrame view="settings-over-app" isRailCollapsed={false} />;
};

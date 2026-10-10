import type { ProviderId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { classifyProviderError } from '../../../features/chat/classifyProviderError';
import { invokeCommand } from '../../../shared/lib/invokeCommand';
import type { SliceDeps } from '../../slice-types';
import { takeProbeSeq } from './applyProviderProbe';
import { logProviderStanding } from './logProviderStanding';
import { overlayProviderHealth } from './overlayProviderHealth';
import { probeLock } from './probeLock';
import { reduceProviderHealth, type HealthEvent } from './providerHealth';
import type { ConnectionTestResult } from './types';

type Params = {
  readonly providerId: ProviderId;
};

export const testProviderConnection =
  ({ set, get }: SliceDeps) =>
  ({ providerId }: Params): Promise<void> => {
    set((state) => ({
      providerConnectionTests: {
        ...state.providerConnectionTests,
        [providerId]: {
          isTesting: true,
          result: state.providerConnectionTests[providerId]?.result ?? null,
        },
      },
    }));
    return probeLock({
      get,
      providerId,
      kind: 'test',
      isAutomatic: false,
      run: async () => {
        let result: ConnectionTestResult;
        try {
          const response = await invokeCommand<
            Readonly<Record<'ok', boolean>> & Omit<ConnectionTestResult, 'isOk'>
          >('provider_test_connection', {
            providerId,
          });
          result = { isOk: response.ok, millis: response.millis, detail: response.detail };
        } catch (error) {
          result = { isOk: false, millis: 0, detail: formatError(error) };
        }
        const state = get();
        const at = Date.now();
        const previous = state.providerHealth[providerId];
        const isRefusal =
          !result.isOk &&
          classifyProviderError({ message: result.detail }).kind === 'authentication';
        const reduced =
          result.isOk || isRefusal
            ? reduceProviderHealth({
                health: previous,
                action: {
                  type: 'run',
                  at,
                  outcome: result.isOk ? 'accepted' : 'refused',
                  message: result.detail,
                },
              }).health
            : previous;
        const event: HealthEvent = {
          at,
          from: previous.standing,
          to: reduced.standing,
          reason: result.isOk
            ? 'Test connection passed'
            : isRefusal
              ? 'Test connection refused'
              : result.detail.toLowerCase().includes('timed out')
                ? 'Probe timed out'
                : 'Test connection failed',
        };
        const health = {
          ...state.providerHealth,
          [providerId]: {
            ...reduced,
            events: [...previous.events, event].slice(-50),
          },
        };
        set({
          providerConnectionTests: {
            ...state.providerConnectionTests,
            [providerId]: { isTesting: false, result },
          },
          providerHealth: health,
          providerProbeSeq: takeProbeSeq(),
          providers: overlayProviderHealth({ providers: state.providers, health }),
        });
        logProviderStanding({ providerId, event });
      },
    });
  };

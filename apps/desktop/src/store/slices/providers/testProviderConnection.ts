import type { ProviderId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { classifyProviderError } from '../../../features/chat/classifyProviderError';
import { invokeCommand } from '../../../shared/lib/invokeCommand';
import type { SliceDeps } from '../../slice-types';
import { accountIdOf } from './accountIdOf';
import { accountPlanOf } from './accountPlanOf';
import { takeProbeSeq } from './applyProviderProbe';
import { logProviderStanding } from './logProviderStanding';
import { overlayProviderHealth } from './overlayProviderHealth';
import { probeLock } from './probeLock';
import { reduceProviderHealth, type HealthEvent } from './providerHealth';
import type { ConnectionTestResult } from './types';

type Params = {
  readonly providerId: ProviderId;
};

type ConnectionTestResponse = Readonly<Record<'ok', boolean>> &
  Omit<ConnectionTestResult, 'isOk'> &
  Readonly<{ models?: unknown }>;

type ListedParams = {
  readonly models: unknown;
};

const listedModelsOf = ({ models }: ListedParams): ReadonlyArray<string> =>
  Array.isArray(models)
    ? models.filter((model: unknown): model is string => typeof model === 'string')
    : [];

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
        const accountId = accountIdOf({ providers: get().providers, providerId });
        const plan = accountPlanOf({ state: get(), providerId });
        let result: ConnectionTestResult;
        let listed: ReadonlyArray<string> = [];
        try {
          const response = await invokeCommand<ConnectionTestResponse>('provider_test_connection', {
            providerId,
          });
          listed = listedModelsOf({ models: response.models });
          result = {
            isOk: response.ok,
            millis: response.millis,
            outcome: response.outcome,
            secs: response.secs,
            detail: response.detail,
          };
        } catch (error) {
          result = {
            isOk: false,
            millis: 0,
            outcome: 'refused',
            secs: null,
            detail: formatError(error),
          };
        }
        const state = get();
        const at = Date.now();
        const previous = state.providerHealth[providerId];
        const isRefusal =
          result.outcome === 'refused' &&
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
              : result.outcome === 'timed_out'
                ? 'Sign-in check timed out'
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
        const current = get();
        if (
          !result.isOk ||
          accountId !== accountIdOf({ providers: current.providers, providerId }) ||
          plan !== accountPlanOf({ state: current, providerId })
        ) {
          return;
        }
        await current
          .learnListedModels({
            providerId,
            accountId,
            plan,
            listed,
            checkedAt: at,
          })
          .catch((error: unknown) => console.warn('remembering the listed models failed', error));
      },
    });
  };

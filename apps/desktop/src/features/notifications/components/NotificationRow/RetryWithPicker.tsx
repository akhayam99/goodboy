import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { NotificationAction } from '@goodboy/db';
import { PROVIDER_CAPABILITIES, resolveTaskModel } from '@goodboy/core';
import type { EffortLevel, ProviderId, TaskModelPreference } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { RoutingPicker } from '../../../../shared/components/RoutingPicker';

type RetryAction = Extract<
  NotificationAction,
  { kind: 'retry-summarizer' } | { kind: 'retry-step-summary' }
>;

type RetryWithPickerProps = {
  readonly action: RetryAction;
  readonly onDone: () => void;
};

export const RetryWithPicker = ({ action, onDone }: RetryWithPickerProps) => {
  const connectedProviderIds = useAppStore(
    useShallow((s) => s.providers.filter((p) => p.connection === 'connected').map((p) => p.id)),
  );
  const sessionProvider = useAppStore(
    (s) => s.sessions.find((x) => x.id === action.sessionId)?.providerPreference.defaultProvider,
  );
  const availableProviderIds = connectedProviderIds.filter(
    (candidate) => PROVIDER_CAPABILITIES[candidate].models.length > 0,
  );
  const initialProvider =
    sessionProvider != null && availableProviderIds.includes(sessionProvider)
      ? sessionProvider
      : availableProviderIds[0];
  const [providerId, setProviderId] = useState<ProviderId | undefined>(initialProvider);
  const [model, setModel] = useState('');
  const [effort, setEffort] = useState<EffortLevel>('medium');
  if (providerId == null) {
    return null;
  }
  const recommendedModel = resolveTaskModel({
    task: 'summarizer',
    preferences: null,
    workspaceDefaultProviderId: providerId,
    sessionDefaultProviderId: providerId,
  }).model;
  const dispatch = () => {
    const taskModel =
      model === ''
        ? resolveTaskModel({
            task: 'summarizer',
            preferences: null,
            workspaceDefaultProviderId: providerId,
            sessionDefaultProviderId: providerId,
          })
        : { providerId, model };
    const override: TaskModelPreference = { ...taskModel, effort };
    const store = useAppStore.getState();
    switch (action.kind) {
      case 'retry-summarizer':
        store.retrySummarizer(action.sessionId, override);
        break;
      case 'retry-step-summary':
        void store.retryStepSummary({
          sessionId: action.sessionId,
          agentId: action.agentId,
          taskModelOverride: override,
        });
        break;
      default: {
        const _exhaustive: never = action;
        return _exhaustive;
      }
    }
    onDone();
  };
  return (
    <div className="flex items-center gap-1.5 pt-1.5">
      <div className="min-w-0 flex-1">
        <RoutingPicker
          ariaLabel="Retry routing"
          connectedProviders={availableProviderIds}
          provider={providerId}
          model={model}
          effort={{ editable: true, value: effort, onChange: setEffort }}
          recommendation={{ model: recommendedModel }}
          disabled={false}
          onProvider={(next) => {
            if (next === '') {
              return;
            }
            setProviderId(next);
            setModel('');
          }}
          onModel={setModel}
        />
      </div>
      <button
        type="button"
        className="rounded-sm px-1.5 py-0.5 text-2xs font-medium text-foreground ring-1 ring-inset ring-foreground/20 hover:bg-hover hover:text-foreground"
        onClick={dispatch}
        aria-label="Confirm retry with selected model"
      >
        Retry
      </button>
    </div>
  );
};

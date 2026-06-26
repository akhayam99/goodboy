import { useCallback, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { ProviderId, Session, TurnProviderOverride } from '@goodboy/types';
import { PROVIDER_CAPABILITIES, getDefaultTurnModel } from '@goodboy/core';
import { useAppStore } from '../../../../../store';
import type { VerbosityLevel } from '../../../../../features/settings/verbosity';
import { type EffortLevel, clampEffort } from '../../../utils/chat-constants';
import { asEffortLevel, asProvider } from '../lib';

type UseTurnRoutingArgs = {
  readonly session: Session;
  readonly isRunning: boolean;
};

export function useTurnRouting({ session, isRunning }: UseTurnRoutingArgs) {
  const storeSetSessionConfig = useAppStore((s) => s.setSessionConfig);
  const storeSetAgentConfig = useAppStore((s) => s.setAgentConfig);
  const storeSetAgentEffortOverride = useAppStore((s) => s.setAgentEffortOverride);
  const storeSetAgentVerbosity = useAppStore((s) => s.setAgentVerbosity);
  const workspaceDefaultVerbosity = useAppStore(
    (s) => s.workspaceOverrides[session.workspaceId]?.defaultVerbosity ?? null,
  );
  const selectedAgentId = useAppStore((s) => s.selectedAgentId[session.id] ?? null);
  const agentModelOverride = useAppStore((s) =>
    selectedAgentId ? (s.agentModelOverride[selectedAgentId] ?? null) : null,
  );
  const connectedProviders = useAppStore(
    useShallow((s) => s.providers.filter((p) => p.connection === 'connected')),
  );

  const [selectedProvider, setSelectedProviderState] = useState<ProviderId | null>(() =>
    asProvider(session.providerOverride),
  );
  const [selectedModel, setSelectedModelState] = useState<string | null>(
    () => session.modelOverride ?? null,
  );
  const [effort, setEffortState] = useState<EffortLevel>(
    () => asEffortLevel(session.effort) ?? 'medium',
  );
  const [verbosity, setVerbosityState] = useState<VerbosityLevel>(() => {
    const initialAgentId = useAppStore.getState().selectedAgentId[session.id] ?? null;
    const initialRuns = useAppStore.getState().sessionPhaseRuns[session.id] ?? [];
    const agentRow = initialAgentId
      ? (initialRuns.find((r) => r.id === initialAgentId) ?? null)
      : null;
    return (
      (agentRow?.verbosity as VerbosityLevel | undefined) ?? workspaceDefaultVerbosity ?? 'normal'
    );
  });

  const currentProviderRef = useRef(selectedProvider);
  currentProviderRef.current = selectedProvider;
  const currentModelRef = useRef(selectedModel);
  currentModelRef.current = selectedModel;
  const currentEffortRef = useRef(effort);
  currentEffortRef.current = effort;

  const allowOverride = session.providerPreference.allowTurnOverride;
  const defaultProvider = session.providerPreference.defaultProvider;
  const defaultModel =
    agentModelOverride ??
    session.providerPreference.defaultModel ??
    getDefaultTurnModel(defaultProvider);
  const effectiveProvider: ProviderId = selectedProvider ?? defaultProvider;
  const effectiveModel =
    selectedModel ??
    (effectiveProvider === defaultProvider ? defaultModel : getDefaultTurnModel(effectiveProvider));
  const effectiveEffort = clampEffort(effectiveModel, effort);
  const providerChanged = selectedProvider !== null && selectedProvider !== defaultProvider;
  const modelChanged = selectedModel !== null && selectedModel !== defaultModel;
  const routingOverride: TurnProviderOverride | undefined =
    allowOverride && (providerChanged || modelChanged)
      ? {
          providerId: effectiveProvider,
          ...(modelChanged ? { model: effectiveModel } : {}),
        }
      : undefined;

  const connectedProviderIds = connectedProviders.map((p) => p.id);
  const providerModels = PROVIDER_CAPABILITIES[effectiveProvider].models;
  const providerCandidates: ReadonlyArray<ProviderId> = ['anthropic', 'cursor', 'codex', 'gemini'];
  const modelCandidates = useMemo<ReadonlyArray<string>>(() => {
    const ids = new Set(providerModels.map((m) => m.id));
    if (effectiveModel) ids.add(effectiveModel);
    return Array.from(ids);
  }, [providerModels, effectiveModel]);

  const setEffort = useCallback(
    (level: EffortLevel) => {
      setEffortState(level);
      void storeSetSessionConfig(session.id, { effort: level });
      if (selectedAgentId) {
        void storeSetAgentConfig(session.id, selectedAgentId, { effort: level });
        storeSetAgentEffortOverride(selectedAgentId, level);
      }
    },
    [
      storeSetSessionConfig,
      storeSetAgentConfig,
      storeSetAgentEffortOverride,
      session.id,
      selectedAgentId,
    ],
  );

  const setVerbosity = useCallback(
    (level: VerbosityLevel) => {
      setVerbosityState(level);
      if (selectedAgentId) {
        void storeSetAgentVerbosity(session.id, selectedAgentId, level);
      }
    },
    [storeSetAgentVerbosity, session.id, selectedAgentId],
  );

  const setSelectedProvider = useCallback(
    (id: ProviderId | null) => {
      setSelectedProviderState(id);
      void storeSetSessionConfig(session.id, { providerOverride: id });
      if (selectedAgentId) {
        void storeSetAgentConfig(session.id, selectedAgentId, { providerOverride: id });
      }
    },
    [storeSetSessionConfig, storeSetAgentConfig, session.id, selectedAgentId],
  );

  const setSelectedModel = useCallback(
    (id: string | null) => {
      setSelectedModelState(id);
      void storeSetSessionConfig(session.id, { modelOverride: id });
      if (selectedAgentId) {
        void storeSetAgentConfig(session.id, selectedAgentId, { modelOverride: id });
      }
    },
    [storeSetSessionConfig, storeSetAgentConfig, session.id, selectedAgentId],
  );

  const onSelectProvider = useCallback(
    (id: ProviderId) => {
      if (!connectedProviderIds.includes(id)) {
        window.dispatchEvent(
          new CustomEvent('goodboy:open-provider-studio', { detail: { providerId: id } }),
        );
        return;
      }
      if (!allowOverride || isRunning) return;
      setSelectedProvider(id);
      setSelectedModel(null);
    },
    [connectedProviderIds, allowOverride, isRunning, setSelectedProvider, setSelectedModel],
  );

  const onSelectModel = useCallback(
    (id: string) => {
      if (!allowOverride || isRunning) return;
      setSelectedModel(id);
    },
    [allowOverride, isRunning, setSelectedModel],
  );

  const onResetTurnOverride = useCallback(() => {
    if (!allowOverride || isRunning) return;
    setSelectedProvider(null);
    setSelectedModel(null);
  }, [allowOverride, isRunning, setSelectedProvider, setSelectedModel]);

  return {
    selectedProvider,
    setSelectedProviderState,
    selectedModel,
    setSelectedModelState,
    effort,
    setEffortState,
    verbosity,
    setVerbosityState,
    effectiveProvider,
    effectiveModel,
    effectiveEffort,
    defaultProvider,
    defaultModel,
    routingOverride,
    allowOverride,
    providerChanged,
    modelChanged,
    currentProviderRef,
    currentModelRef,
    currentEffortRef,
    connectedProviderIds,
    providerCandidates,
    modelCandidates,
    setEffort,
    setVerbosity,
    setSelectedProvider,
    setSelectedModel,
    onSelectProvider,
    onSelectModel,
    onResetTurnOverride,
  };
}

import { useCallback, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { ProviderId, Session, TurnProviderOverride } from '@goodboy/types';
import { PROVIDER_CAPABILITIES, getDefaultTurnModel, resolveModelForProvider } from '@goodboy/core';
import { useAppStore } from '../../../../../store';
import type { VerbosityLevel } from '../../../../../features/settings/verbosity';
import { type EffortLevel, clampEffort } from '../../../utils/chat-constants';
import { asEffortLevel, asProvider } from '../lib';

type Params = {
  readonly session: Session;
  readonly isRunning: boolean;
};

export const useTurnRouting = ({ session, isRunning }: Params) => {
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
  const agentProviderOverride = useAppStore((s) =>
    selectedAgentId ? (s.agentProviderOverride[selectedAgentId] ?? null) : null,
  );
  const connectedProviders = useAppStore(
    useShallow((s) => s.providers.filter((p) => p.connection === 'connected')),
  );

  const [selectedProvider, setSelectedProviderState] = useState<ProviderId | null>(() => {
    const initialAgentId = useAppStore.getState().selectedAgentId[session.id] ?? null;
    const initialRuns = useAppStore.getState().sessionPhaseRuns[session.id] ?? [];
    const initialAgent = initialAgentId
      ? (initialRuns.find((r) => r.id === initialAgentId) ?? null)
      : null;
    return asProvider(initialAgent?.providerOverride) ?? asProvider(session.providerOverride);
  });
  const [selectedModel, setSelectedModelState] = useState<string | null>(() => {
    const initialAgentId = useAppStore.getState().selectedAgentId[session.id] ?? null;
    const initialRuns = useAppStore.getState().sessionPhaseRuns[session.id] ?? [];
    const initialAgent = initialAgentId
      ? (initialRuns.find((r) => r.id === initialAgentId) ?? null)
      : null;
    const persistedModel = initialAgent?.modelOverride ?? session.modelOverride ?? null;
    if (persistedModel === null) {
      return null;
    }
    const initialProvider =
      selectedProvider ?? agentProviderOverride ?? session.providerPreference.defaultProvider;
    return resolveModelForProvider({ provider: initialProvider, modelId: persistedModel });
  });
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
  const defaultModel = resolveModelForProvider({
    provider: defaultProvider,
    modelId:
      agentModelOverride ??
      session.providerPreference.defaultModel ??
      getDefaultTurnModel(defaultProvider),
  });
  const effectiveProvider: ProviderId =
    selectedProvider ?? agentProviderOverride ?? defaultProvider;
  const effectiveModel = resolveModelForProvider({
    provider: effectiveProvider,
    modelId:
      selectedModel ??
      session.modelOverride ??
      (effectiveProvider === defaultProvider
        ? defaultModel
        : getDefaultTurnModel(effectiveProvider)),
  });
  const effectiveEffort = clampEffort(effectiveModel, effort);
  const routingOverride: TurnProviderOverride | undefined = allowOverride
    ? { providerId: effectiveProvider, model: effectiveModel }
    : undefined;

  const connectedProviderIds = connectedProviders.map((p) => p.id);
  const providerModels = PROVIDER_CAPABILITIES[effectiveProvider].models;
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
      if (!allowOverride || isRunning) return;
      setSelectedProviderState(id);
      setSelectedModelState(null);
      void storeSetSessionConfig(session.id, { providerOverride: id, modelOverride: null });
      if (selectedAgentId) {
        void storeSetAgentConfig(session.id, selectedAgentId, {
          providerOverride: id,
          modelOverride: null,
        });
      }
    },
    [
      allowOverride,
      isRunning,
      storeSetSessionConfig,
      storeSetAgentConfig,
      session.id,
      selectedAgentId,
    ],
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
    currentProviderRef,
    currentModelRef,
    currentEffortRef,
    connectedProviderIds,
    modelCandidates,
    setEffort,
    setVerbosity,
    setSelectedProvider,
    setSelectedModel,
    onSelectProvider,
    onSelectModel,
    onResetTurnOverride,
  };
};

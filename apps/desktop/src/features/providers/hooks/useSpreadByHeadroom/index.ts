import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { DEFAULT_SESSION_PROVIDER_PREFERENCE, readHeadroom } from '@goodboy/core';
import { DEFAULT_WORKFLOW_RULES, type WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useNow } from '../../../../shared/hooks/useNow';
import {
  canSpreadByHeadroom,
  nextStepPick,
  rulesProviderRooms,
} from '../../../workflows/rulesHeadroom';
import { spreadSentence } from '../../../workflows/spreadSentence';
import { policyRows } from '../../policy/policyRows';

type Params = {
  readonly workspaceId: WorkspaceId;
};

export type SpreadByHeadroomModel = Readonly<{
  canSpread: boolean;
  isOn: boolean;
  sentence: string;
  setSpread: (spread: boolean) => void;
}>;

export const useSpreadByHeadroom = ({ workspaceId }: Params): SpreadByHeadroomModel => {
  const stored = useAppStore(
    (state) =>
      state.workspaceOverrides[workspaceId]?.workflowRules?.spreadByHeadroom ??
      DEFAULT_WORKFLOW_RULES.spreadByHeadroom,
  );
  const policy = useAppStore(
    (state) => state.workspaceOverrides[workspaceId]?.providerPool ?? null,
  );
  const savedDefault = useAppStore(
    (state) => state.workspaceOverrides[workspaceId]?.defaultProviderId ?? null,
  );
  const connected = useAppStore(
    useShallow((state) =>
      state.providers
        .filter((provider) => provider.connection === 'connected')
        .map((provider) => provider.id),
    ),
  );
  const limits = useAppStore((state) => state.providerLimits);
  const patchWorkspaceOverrides = useAppStore((state) => state.patchWorkspaceOverrides);
  const reportError = useAppStore((state) => state.reportError);
  const nowMs = useNow(60_000, stored);
  const defaultProvider = savedDefault ?? DEFAULT_SESSION_PROVIDER_PREFERENCE.defaultProvider;
  const rooms = useMemo(
    () =>
      rulesProviderRooms({
        rows: policyRows({ policy, defaultProvider, connected, limits, nowMs }),
        headroom: readHeadroom({ limits, policy, nowMs }).headroom,
        limits,
      }),
    [connected, defaultProvider, limits, nowMs, policy],
  );
  const canSpread = canSpreadByHeadroom({ rooms });
  const isOn = canSpread && stored;
  const sentence = spreadSentence({
    canSpread,
    spread: isOn,
    pick: nextStepPick({ rooms, spread: isOn }),
  });

  const setSpread = useCallback(
    (spreadByHeadroom: boolean) => {
      const current =
        useAppStore.getState().workspaceOverrides[workspaceId]?.workflowRules ??
        DEFAULT_WORKFLOW_RULES;
      patchWorkspaceOverrides({
        workspaceId,
        patch: { workflowRules: { ...current, spreadByHeadroom } },
      }).catch((error: unknown) => {
        void reportError({ title: "Couldn't save the workflow rules", error, workspaceId });
      });
    },
    [patchWorkspaceOverrides, reportError, workspaceId],
  );

  return { canSpread, isOn, sentence, setSpread };
};

import { useEffect, useState } from 'react';
import { DEFAULT_WORKFLOW_RULES } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { SessionDraftPane } from '../../../../../features/session/components/SessionDraftPane';
import type { SessionDraft } from '../../../../../store/slices/sessionDraft/state';
import { useSceneClicks } from '../audit/useSceneClicks';
import { WORKSPACE_ID } from '../BoardScene';
import { StudioFrame } from '../StudioFrame';
import { seedStartPage } from '../u27/startPage/seedStartPage';

type Props = {
  readonly draft: Partial<SessionDraft>;
  readonly openLabels: ReadonlyArray<string>;
  readonly guidance?: string;
};

const RUN_DEFAULT_USD = 8;

export const StartFormScene = ({ draft, openLabels, guidance }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedStartPage({ draft: { hasChosenStart: true, ...draft } });
    useAppStore.setState({
      workspaceValues: { [WORKSPACE_ID]: { 'auto.treeLimitUsd': '5' } },
      loadWorkspaceValue: async () => null,
    });
    useAppStore.setState((state) => {
      const current =
        state.workspaceOverrides[WORKSPACE_ID] ??
        state.workspaces.find((workspace) => workspace.id === WORKSPACE_ID)?.overrides;
      return current === undefined
        ? {}
        : {
            workspaceOverrides: {
              ...state.workspaceOverrides,
              [WORKSPACE_ID]: {
                ...current,
                workflowRules: {
                  ...DEFAULT_WORKFLOW_RULES,
                  spendLimitUsd: RUN_DEFAULT_USD,
                  ...(guidance !== undefined && { standingGuidance: guidance }),
                },
              },
            },
          };
    });
    setIsReady(true);
  }, [draft, guidance]);

  useSceneClicks({
    isReady,
    labels: openLabels,
    selector: 'button',
    match: 'prefix',
    intervalMs: 300,
  });

  if (!isReady) {
    return null;
  }
  return (
    <StudioFrame
      target={{ place: null, tool: null }}
      main={<SessionDraftPane workspaceId={WORKSPACE_ID} />}
    />
  );
};

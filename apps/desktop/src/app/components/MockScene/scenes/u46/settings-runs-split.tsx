import { DEFAULT_WORKFLOW_RULES } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { EveryRunFrame } from '../audit/EveryRunFrame';
import { SETTINGS_WORKSPACE_ID } from '../audit/settingsSeed';

const seedSplitLevels = (): void => {
  useAppStore.setState((state) => {
    const overrides = state.workspaceOverrides[SETTINGS_WORKSPACE_ID];
    if (overrides === undefined) {
      return {};
    }
    return {
      workspaceOverrides: {
        ...state.workspaceOverrides,
        [SETTINGS_WORKSPACE_ID]: {
          ...overrides,
          workflowRules: { ...DEFAULT_WORKFLOW_RULES, autonomy: 'step' },
        },
      },
      workspaceValues: {
        ...state.workspaceValues,
        [SETTINGS_WORKSPACE_ID]: {
          'auto.level': JSON.stringify({ defaultLevel: 'plan', sessions: {} }),
        },
      },
    };
  });
};

export const U46_SETTINGS_RUNS_SCENES = {
  'settings-runs-split': () => (
    <EveryRunFrame seed={seedSplitLevels} />
  ),
};

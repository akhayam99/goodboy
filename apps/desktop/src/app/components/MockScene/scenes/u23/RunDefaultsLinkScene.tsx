import { useEffect, useState } from 'react';
import { WorkflowStudio } from '../../../../../features/workflows/components/WorkflowStudio';
import { useAppStore } from '../../../../../store';
import { RULES_PROVIDERS, rulesProviderLimits } from '../audit/workflowRulesSeed';
import { OVERRIDES, WORKSPACE_ID } from '../flow-audit/fixtures';

const noop = () => undefined;

const seedRunDefaults = (): void => {
  useAppStore.setState({
    workflowStudioView: 'rules',
    providers: RULES_PROVIDERS,
    refreshProviders: async () => undefined,
    providerLimits: rulesProviderLimits(),
    loadPhaseTemplates: async () => undefined,
    loadStepLibrary: async () => undefined,
    setWorkflowStudioVisible: noop,
    workspaceOverrides: {
      [WORKSPACE_ID]: {
        ...OVERRIDES,
        providerPool: [
          { id: 'anthropic', state: 'on' },
          { id: 'codex', state: 'on' },
          { id: 'cursor', state: 'backup' },
          { id: 'gemini', state: 'off' },
        ],
      },
    },
  });
};

export const RunDefaultsLinkScene = () => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    seedRunDefaults();
    setIsReady(true);
  }, []);
  return isReady ? <WorkflowStudio workspaceId={WORKSPACE_ID} onClose={noop} /> : null;
};

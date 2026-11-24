import { useEffect, useState } from 'react';
import { WorkflowStudio } from '../../../../../features/workflows/components/WorkflowStudio';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { useAppStore } from '../../../../../store';
import {
  FLOW_SESSION,
  OVERRIDES,
  PRESETS,
  PROVIDERS,
  WORKSPACE,
  WORKSPACE_ID,
  noop,
} from '../flow-audit/fixtures';

type Props = {
  readonly theme: 'dark' | 'light';
  readonly hasPlanRun: boolean;
};

export const WorkflowsEveryRunScene = ({ theme, hasPlanRun }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    applyDocumentTheme({ theme });
    useAppStore.setState({
      workspaces: [WORKSPACE],
      currentWorkspaceId: WORKSPACE_ID,
      providers: PROVIDERS,
      workspaceOverrides: {
        [WORKSPACE_ID]: {
          ...OVERRIDES,
          roleModels: {
            reviewer: { providerId: 'anthropic', model: 'claude-opus-5-5', effort: 'high' },
          },
        },
      },
      sessions: hasPlanRun ? [FLOW_SESSION] : [],
      phaseTemplates: { [WORKSPACE_ID]: PRESETS },
      stepLibrary: { [WORKSPACE_ID]: [] },
      workflowStudioView: 'every',
      loadPhaseTemplates: async () => undefined,
      loadStepLibrary: async () => undefined,
      setWorkflowStudioVisible: noop,
    });
    setIsReady(true);
  }, [theme, hasPlanRun]);

  if (!isReady) {
    return null;
  }

  return <WorkflowStudio workspaceId={WORKSPACE_ID} onClose={noop} />;
};

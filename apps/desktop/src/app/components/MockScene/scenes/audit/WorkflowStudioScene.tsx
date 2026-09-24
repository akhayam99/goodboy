import { useEffect, useState } from 'react';
import { WorkflowStudio } from '../../../../../features/workflows/components/WorkflowStudio';
import { useAppStore } from '../../../../../store';
import { WorkflowBuilderScene } from '../flow-audit/WorkflowBuilderScene';
import { WORKSPACE_ID } from '../flow-audit/fixtures';
import { sceneParam } from './sceneParams';
import { useSceneClicks } from './useSceneClicks';

const noop = () => undefined;

const IS_EMPTY = sceneParam({ key: 'v' }) === 'empty';
const OPEN = sceneParam({ key: 'open' });
const OPEN_LABELS: ReadonlyArray<string> = OPEN === null ? [] : [OPEN];

const seedStudio = (): void => {
  useAppStore.setState({
    loadPhaseTemplates: async () => undefined,
    loadStepLibrary: async () => undefined,
    setWorkflowStudioVisible: noop,
  });
  if (!IS_EMPTY) {
    return;
  }
  useAppStore.setState({
    phaseTemplates: { [WORKSPACE_ID]: [] },
    stepLibrary: { [WORKSPACE_ID]: [] },
  });
};

export const WorkflowStudioScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedStudio();
    setIsReady(true);
  }, []);

  useSceneClicks({
    isReady,
    labels: OPEN_LABELS,
    selector: '[data-studio-overlay] button',
    match: 'contains',
    intervalMs: 200,
  });

  return (
    <>
      <WorkflowBuilderScene />
      {isReady && <WorkflowStudio workspaceId={WORKSPACE_ID} onClose={noop} />}
    </>
  );
};

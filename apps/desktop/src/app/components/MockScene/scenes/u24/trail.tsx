import { TrailScene } from './trail/TrailScene';

export const U24_TRAIL_SCENES = {
  'trail-run': () => (
    <TrailScene
      title="Refactor ledger exports"
      input={{ lens: 'workflows', focusedWorkflowName: 'Refactor ledger exports' }}
    />
  ),
  'trail-artifact': () => (
    <TrailScene
      title="Harborline migration plan"
      input={{ lens: 'plans', focusedArtifactTitle: 'Harborline migration plan' }}
    />
  ),
  'trail-agent': () => (
    <TrailScene
      title="Implement"
      input={{
        lens: 'workflows',
        selectedChildHome: 'workflows',
        selectedChildLabel: 'Implement',
        selectedChildWorkflowName: 'Refactor ledger exports',
      }}
    />
  ),
  'trail-artifact-create': () => (
    <TrailScene
      title="Create report"
      input={{ lens: 'plans', artifactCreationLabel: 'Create report' }}
    />
  ),
};

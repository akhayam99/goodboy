import { mockIPC } from '@tauri-apps/api/mocks';
import { PaneShell } from '@goodboy/ui';
import { GuideStudio } from '../../../../../features/settings/components/GuideStudio';
import { ImpactStudio } from '../../../../../features/impact/components/ImpactStudio';
import { WorkflowStudio } from '../../../../../features/workflows/components/WorkflowStudio';
import { useAppStore } from '../../../../../store';
import { FirstLapFrame } from '../audit/FirstLapFrame';
import { OpenQuestionsScene } from '../flow-audit/OpenQuestionsScene';
import { WORKSPACE_ID } from '../flow-audit/fixtures';
import { CommitsToolbarScene } from './CommitsToolbarScene';
import { FramedStudioScene } from './FramedStudioScene';

const noop = () => undefined;

const INBOX_ROWS: ReadonlyArray<string> = [
  'Settlement export off by a few cents',
  'Export button stays disabled after a failed export',
  'Reconcile the nightly settlement export before the Monday close',
  'Webhook retries post a second credit',
  'Payout hold warning arrives after the hold',
  'Rate limit on the public API is per account, not per tenant',
  'Pin the FX rates provider timeout',
  'Drop the unused Acme sandbox keys',
];

const seedWorkflows = (): void => {
  useAppStore.setState({
    loadPhaseTemplates: async () => undefined,
    loadStepLibrary: async () => undefined,
    setWorkflowStudioVisible: noop,
  });
};

const seedImpact = (): void => {
  mockIPC(() => []);
};

export const U23_FRAME_SCENES = {
  'frame-studio-inbox': () => (
    <FramedStudioScene kind="inbox" place="inbox">
      <PaneShell scroll="body" title="All items" meta={`${INBOX_ROWS.length} items`}>
        <ul aria-label="Inbox items" className="flex flex-col gap-3">
          {INBOX_ROWS.map((row) => (
            <li key={row} className="text-body text-foreground">
              {row}
            </li>
          ))}
        </ul>
      </PaneShell>
    </FramedStudioScene>
  ),
  'frame-studio-workflows': () => (
    <FramedStudioScene kind="workflow" place="workflows" seed={seedWorkflows}>
      <WorkflowStudio workspaceId={WORKSPACE_ID} onClose={noop} />
    </FramedStudioScene>
  ),
  'frame-studio-impact': () => (
    <FramedStudioScene kind="impact" place="impact" seed={seedImpact}>
      <ImpactStudio workspaceId={WORKSPACE_ID} onClose={noop} />
    </FramedStudioScene>
  ),
  'frame-studio-guide': () => (
    <FramedStudioScene kind="guide" place="link">
      <GuideStudio onClose={noop} />
    </FramedStudioScene>
  ),
  'frame-questions': OpenQuestionsScene,
  'frame-first-lap-notice': () => <FirstLapFrame state="lap" isOverview />,
  'branch-commits-toolbar': CommitsToolbarScene,
};

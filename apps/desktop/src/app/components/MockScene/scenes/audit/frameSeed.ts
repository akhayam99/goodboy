import type { IntegrationGlyphProvider } from '../../../../../features/integrations/components/IntegrationGlyph';
import { useAppStore } from '../../../../../store';
import { seedBoardScene } from '../BoardScene';
import { NOW, SESSION, seedWorkflowScene } from '../workflowSeed';
import { seedShellChrome } from '../shellChrome';

export type FrameContext = 'board' | 'session' | 'rail' | 'empty';

export const FRAME_CONNECTED: Readonly<Record<IntegrationGlyphProvider, boolean>> = {
  github: true,
  linear: true,
  sentry: false,
  jira: false,
  gitlab: false,
  bitbucket: false,
  slack: false,
};

const noop = () => undefined;

export const seedFrameChromeStubs = (): void => {
  useAppStore.setState({
    notifications: [],
    notificationsLoading: false,
    loadNotifications: async () => undefined,
    markNotificationsRead: async () => undefined,
    scriptRuns: {},
    projectScripts: {},
    setCurrentSession: async () => undefined,
    setActiveLens: noop,
  });
};

type SeedParams = {
  readonly context: FrameContext;
};

export const seedFrame = ({ context }: SeedParams): void => {
  if (context === 'session' || context === 'rail') {
    seedWorkflowScene();
    seedShellChrome({
      session: SESSION,
      siblings: [],
      branches: {},
      telemetryAt: NOW,
      lens: 'agents',
    });
    useAppStore.setState({ activeLens: {} });
    return;
  }
  seedBoardScene();
  seedFrameChromeStubs();
  if (context === 'empty') {
    useAppStore.setState({ workspaces: [], currentWorkspaceId: null, currentSessionId: null });
  }
};

const FRAME_CONTEXTS: ReadonlyArray<FrameContext> = ['board', 'session', 'rail', 'empty'];

type ContextParams = {
  readonly value: string | null;
};

export const frameContextOf = ({ value }: ContextParams): FrameContext =>
  FRAME_CONTEXTS.find((context) => context === value) ?? 'board';

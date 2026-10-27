import { useEffect, useState } from 'react';
import { brandId, type MountId, type SessionId } from '@goodboy/types';
import { SETTINGS_PROJECTS } from '../audit/settingsSeed';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { useAppStore } from '../../../../../store';
import { WorktreeSetupOffer } from '../../../../../features/session/components/SessionOverviewPane/ProjectMountRows/WorktreeSetupOffer';
import { NewWorktreesField } from '../../../../../features/worktree/NewWorktreesField';
import { mockSceneIpc } from '../mockSceneIpc';

type Variant = 'offer' | 'carry';

type Props = {
  readonly variant: Variant;
};

const SESSION = brandId<SessionId>({ value: 'mock-p25-setup-session' });
const MOUNT = brandId<MountId>({ value: 'mock-p25-setup-mount' });
const WORKTREE = '/mock/harborline/payments-api/.goodboy/worktrees/retry-webhook';

const CANDIDATES = [
  { path: '.env.local', isDirectory: false, isSecret: true, sizeBytes: 214, isLarge: false },
  {
    path: 'config/local.json',
    isDirectory: false,
    isSecret: false,
    sizeBytes: 482,
    isLarge: false,
  },
  { path: 'fixtures', isDirectory: true, isSecret: false, sizeBytes: null, isLarge: true },
];

const seedOffer = (): void => {
  useAppStore.setState({
    settings: {
      [`worktree.setup-offer.${MOUNT}`]: JSON.stringify({
        command: 'pnpm install',
        carried: 2,
        skipped: 0,
        state: 'offered',
      }),
    },
    scriptRuns: {},
    loadSetting: async () => null,
    runDiscoveredScript: async () => {
      useAppStore.setState((state) => ({
        settings: {
          ...state.settings,
          [`worktree.setup-offer.${MOUNT}`]: JSON.stringify({
            command: 'pnpm install',
            carried: 2,
            skipped: 0,
            state: 'done',
          }),
        },
      }));
      return { stdout: '', stderr: '', exitCode: 0 };
    },
  });
};

const seedCarry = (): void => {
  mockSceneIpc((command) => {
    if (command === 'worktree_carry_candidates') {
      return CANDIDATES;
    }
    if (command === 'worktree_setup_proposal') {
      return { command: 'pnpm install', source: 'pnpm-lock.yaml' };
    }
    return undefined;
  });
  useAppStore.setState({ settings: {} });
};

const PROJECT = SETTINGS_PROJECTS.find((project) => project.name === 'payments-api');

const NewWorktreeScene = ({ variant }: Props) => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    const seed = variant === 'offer' ? seedOffer : seedCarry;
    seed();
    setIsReady(true);
  }, [variant]);
  if (!isReady || PROJECT === undefined) {
    return null;
  }
  return (
    <ToastProvider>
      <main className="mx-auto flex max-w-2xl flex-col gap-2 p-6">
        <h1 className="text-row text-foreground">payments-api</h1>
        {variant === 'offer' ? (
          <WorktreeSetupOffer
            sessionId={SESSION}
            mountId={MOUNT}
            worktreePath={WORKTREE}
            projectName="payments-api"
            branch="retry-webhook"
          />
        ) : (
          <NewWorktreesField project={PROJECT} />
        )}
      </main>
    </ToastProvider>
  );
};

export const U23P25_NEW_WORKTREE_SCENES = {
  'p25-worktree-offer': () => <NewWorktreeScene variant="offer" />,
  'p25-worktree-carry': () => <NewWorktreeScene variant="carry" />,
};

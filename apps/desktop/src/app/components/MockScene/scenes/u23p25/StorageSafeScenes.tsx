import { useAppStore } from '../../../../../store';
import type { StorageRemovalSummary } from '../../../../../store/slices/storage/types';
import { brandId, type SessionId } from '@goodboy/types';
import type { TerminalTab, TerminalTabId } from '../../../../../shared/types/terminal';
import { SettingsFrame } from '../audit/SettingsFrame';
import { seedStorageScene } from '../brand/StorageScene';

type Variant = 'terminal' | 'undo';

type Props = {
  readonly variant: Variant;
};

const seedQuietStorage = (): void => {
  seedStorageScene();
  useAppStore.setState({
    openSecurityFindings: {},
    dismissedSecurityFindings: {},
    loadSecurityFindings: async () => undefined,
  });
};

const seedTerminal = (): void => {
  seedQuietStorage();
  const first = useAppStore.getState().storageFolders[0];
  if (first === undefined) {
    return;
  }
  const sessionId = first.sessionId ?? brandId<SessionId>({ value: 'mock-p25-session' });
  const tab: TerminalTab = {
    id: brandId<TerminalTabId>({ value: 'mock-p25-terminal' }),
    owner: { kind: 'session', sessionId },
    title: 'pnpm dev',
    cwd: first.path,
    status: 'running',
    createdAt: Date.now(),
  };
  useAppStore.setState({ terminalTabs: { [sessionId]: [tab] } });
};

type BroughtBackParams = {
  readonly restored: number;
};

const broughtBack = ({ restored }: BroughtBackParams): StorageRemovalSummary | null => {
  const outcome = useAppStore.getState().storageOutcome;
  if (outcome === null) {
    return null;
  }
  return { ...outcome, restorable: [], undo: { restored, failed: [] }, isUndoing: false };
};

const seedUndo = (): void => {
  seedQuietStorage();
  const folders = useAppStore.getState().storageFolders;
  useAppStore.setState({
    storageFolders: [],
    storageOutcome: {
      removed: folders.length,
      freedBytes: folders.reduce((sum, folder) => sum + (folder.sizeBytes ?? 0), 0),
      kept: [],
      restorable: folders.map((folder) => ({
        path: folder.path,
        repoRoot: folder.repoRoot,
        branch: folder.branch,
        origin: 'archived' as const,
        sessionId: folder.sessionId,
        mountId: folder.mountId,
        revision: 2,
      })),
      undo: null,
      isUndoing: false,
    },
    undoStorageRemoval: async () => {
      const next = broughtBack({ restored: folders.length });
      useAppStore.setState({ storageFolders: folders, storageOutcome: next });
    },
  });
};

const StorageSafeScene = ({ variant }: Props) => (
  <SettingsFrame
    focus={{ scope: 'app', section: 'storage' }}
    seed={variant === 'terminal' ? seedTerminal : seedUndo}
  />
);

export const P25_STORAGE_SCENES = {
  'p25-storage-terminal': () => <StorageSafeScene variant="terminal" />,
  'p25-storage-undo': () => <StorageSafeScene variant="undo" />,
};

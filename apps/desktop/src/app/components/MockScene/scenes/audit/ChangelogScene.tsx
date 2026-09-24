import { useEffect, useState } from 'react';
import { mockIPC } from '@tauri-apps/api/mocks';
import { ToastProvider } from '../../../Toast';
import { ChangelogStudio } from '../../../../../features/changelog/components/ChangelogStudio';
import { useAppStore } from '../../../../../store';
import { sceneParam } from './sceneParams';

const noop = () => undefined;

const IS_FAILED = sceneParam({ key: 'state' }) === 'failed';
const FETCH_ERROR = 'network unreachable';

const RELEASES = [
  {
    version: 'v0.3.14',
    publishedAt: '2026-09-22T18:00:00.000Z',
    body: '## Pull requests carry the queued check state\n\nA check that is still queued shows as queued, not as passing.\n\n- Fix: the rebase agent no longer stops when the base branch moved during the run.',
    htmlUrl: 'https://example.invalid/releases/v0.3.14',
  },
  {
    version: 'v0.3.13',
    publishedAt: '2026-09-20T18:00:00.000Z',
    body: '## Opus 5.5 in the model picker\n\nPick it per step or per role.\n\n- Fix: OpenRouter models that no longer exist are gone from the list.',
    htmlUrl: 'https://example.invalid/releases/v0.3.13',
  },
  {
    version: 'v0.3.12',
    publishedAt: '2026-09-17T18:00:00.000Z',
    body: '',
    htmlUrl: 'https://example.invalid/releases/v0.3.12',
  },
];

export const ChangelogScene = () => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    mockIPC((cmd) => {
      if (cmd === 'plugin:app|version') {
        return '0.3.13';
      }
      if (cmd === 'releases_list') {
        if (IS_FAILED) {
          throw new Error(FETCH_ERROR);
        }
        return RELEASES;
      }
      return null;
    });
    useAppStore.setState({
      changelogReleases: IS_FAILED ? [] : RELEASES,
      changelogStatus: IS_FAILED ? 'error' : 'ready',
      changelogError: IS_FAILED ? FETCH_ERROR : null,
      changelogFetchedAt: null,
      loadChangelog: async () => undefined,
      reloadChangelog: async () => undefined,
      markChangelogSeen: async () => undefined,
      updaterStatus: 'available',
      updateVersion: '0.3.14',
    });
    setIsReady(true);
  }, []);
  if (!isReady) {
    return null;
  }
  return (
    <ToastProvider>
      <main className="h-screen overflow-hidden bg-background text-foreground">
        <ChangelogStudio onClose={noop} />
      </main>
    </ToastProvider>
  );
};

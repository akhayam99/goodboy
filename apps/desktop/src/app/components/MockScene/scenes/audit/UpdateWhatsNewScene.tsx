import { useEffect, useState } from 'react';
import { mockIPC } from '@tauri-apps/api/mocks';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { ChangelogStudio } from '../../../../../features/changelog/components/ChangelogStudio';
import { parseChangelog } from '../../../../../features/changelog/parseChangelog';
import { UpdatePill } from '../../../../../features/updater/components/UpdatePill';
import { useAppStore } from '../../../../../store';
import { sceneParam } from './sceneParams';

const noop = () => undefined;

const INSTALLED_VERSION = '0.12.3';
const TARGET_VERSION = '0.13.1';
const IS_OFFLINE = sceneParam({ key: 'state' }) === 'offline';

const FETCHED_CHANGELOG = [
  '# Changelog',
  '',
  '## Goodboy v0.13.1',
  '',
  'Chats keep their place, and the Harborline board scrolls again.',
  '',
  '### Fixed',
  '',
  '- A chat reopens on the message you left it at. <!-- gb area=sessions -->',
  '- The board keeps its scroll when a session of ledger-core finishes. <!-- gb area=app -->',
  '',
  '## Goodboy v0.13.0',
  '',
  'Ask about a workspace in a chat of its own, and turn the answer into work.',
  '',
  'This version updates your data in one direction. To go back to 0.12, restore the backup Goodboy made before updating.',
  '',
  '### New',
  '',
  '#### Chat',
  '<!-- gb area=sessions -->',
  '',
  'Open Chat next to Board to ask about payments-api or storefront-web. The chat reads the workspace with read-only tools and answers with the files it looked at.',
  '',
  '#### Turn a chat into work',
  '<!-- gb area=sessions -->',
  '',
  'Start a session from the answer, or send it to a session that is already running.',
  '',
  '### Improved',
  '',
  '#### Questions stay with their agent',
  '<!-- gb area=agents -->',
  '',
  'An open question shows on its agent card until you answer it.',
  '',
  '## Goodboy v0.12.3',
  '',
  'Already installed.',
  '',
  '### Fixed',
  '',
  '- Nothing new here. <!-- gb area=app -->',
  '',
].join('\n');

export const UpdateWhatsNewScene = () => {
  const [isReady, setIsReady] = useState(false);
  const [isChangelogOpen, setIsChangelogOpen] = useState(false);
  useEffect(() => {
    mockIPC((cmd) => {
      if (cmd === 'plugin:app|version') {
        return INSTALLED_VERSION;
      }
      if (cmd === 'release_changelog') {
        if (IS_OFFLINE) {
          throw new Error('network unreachable');
        }
        return FETCHED_CHANGELOG;
      }
      if (cmd === 'releases_list') {
        return [];
      }
      return null;
    });
    useAppStore.setState({
      loadChangelogDates: async () => undefined,
      reloadChangelogDates: async () => undefined,
      markChangelogSeen: async () => undefined,
      applyUpdate: async () => undefined,
      changelogUpcoming: null,
      updateNotes: IS_OFFLINE ? (parseChangelog({ text: FETCHED_CHANGELOG })[0] ?? null) : null,
      updaterStatus: IS_OFFLINE ? 'ready' : 'available',
      updateVersion: TARGET_VERSION,
    });
    setIsReady(true);
  }, []);
  if (!isReady) {
    return null;
  }
  return (
    <ToastProvider>
      <main className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
        {isChangelogOpen ? (
          <ChangelogStudio onClose={() => setIsChangelogOpen(false)} onOpenScreen={noop} />
        ) : (
          <div className="flex h-9 items-center justify-end px-3">
            <UpdatePill onOpenChangelog={() => setIsChangelogOpen(true)} />
          </div>
        )}
      </main>
    </ToastProvider>
  );
};

import { mockIPC } from '@tauri-apps/api/mocks';
import { HelpStudio } from '../../../HelpStudio';
import { useAppStore } from '../../../../../store';
import { FramedStudioScene } from '../u23/FramedStudioScene';
import { sceneParam } from './sceneParams';

const noop = () => undefined;

const IS_FAILED = sceneParam({ key: 'state' }) === 'failed';
const FETCH_ERROR = 'network unreachable';

const DATE_RELEASES = [
  { version: 'v0.7.0', publishedAt: '2026-09-22T18:00:00.000Z' },
  { version: 'v0.6.0', publishedAt: '2026-09-10T18:00:00.000Z' },
];

const seedChangelog = (): void => {
  mockIPC((cmd) => {
    if (cmd === 'plugin:app|version') {
      return '0.7.0';
    }
    if (cmd === 'releases_list') {
      if (IS_FAILED) {
        throw new Error(FETCH_ERROR);
      }
      return DATE_RELEASES;
    }
    return null;
  });
  useAppStore.setState({
    loadChangelogDates: async () => undefined,
    reloadChangelogDates: async () => undefined,
    markChangelogSeen: async () => undefined,
    updaterStatus: 'available',
    updateVersion: '0.7.0',
  });
};

export const ChangelogScene = () => (
  <ToastProvider>
    <FramedStudioScene kind="changelog" place="changelog" seed={seedChangelog}>
      <HelpStudio tab="whatsNew" onClose={noop} onOpenScreen={noop} />
    </FramedStudioScene>
  </ToastProvider>
);

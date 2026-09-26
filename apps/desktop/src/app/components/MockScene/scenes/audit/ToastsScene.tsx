import { useEffect, useState } from 'react';
import { mockIPC } from '@tauri-apps/api/mocks';
import { ToastProvider } from '../../../Toast';
import { ReleaseNoticeBridge } from '../../../../../features/changelog/components/ReleaseNoticeBridge';
import { UpdateIndicator } from '../../../../../features/updater/components/UpdateIndicator';
import { useAppStore } from '../../../../../store';
import { ToastsFirer } from './ToastsFirer';
import { sceneParam } from './sceneParams';

const noop = () => undefined;

const VARIANT = sceneParam({ key: 'set' }) ?? 'kinds';

export const ToastsScene = () => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    mockIPC((cmd) => {
      if (cmd === 'plugin:app|version') {
        return '0.3.13';
      }
      return null;
    });
    useAppStore.setState({
      changelogSeenVersion: '0.3.12',
      changelogSeenHydrated: true,
      updaterStatus: VARIANT === 'downloading' ? 'downloading' : 'available',
      updateVersion: '0.3.14',
      installUpdate: async () => undefined,
    });
    setIsReady(true);
  }, []);
  if (!isReady) {
    return null;
  }
  return (
    <ToastProvider>
      <main className="flex h-screen flex-col bg-background text-foreground">
        <div className="flex h-9 items-center justify-end gap-3 border-b border-border px-3">
          <span className="text-secondary text-muted-foreground">footer pip</span>
          <UpdateIndicator variant="pip" />
          <span className="text-secondary text-muted-foreground">launcher bar</span>
          <UpdateIndicator variant="bar" />
        </div>
        <div className="flex-1" />
        <ToastsFirer variant={VARIANT} />
        <ReleaseNoticeBridge onOpenChangelog={noop} />
      </main>
    </ToastProvider>
  );
};

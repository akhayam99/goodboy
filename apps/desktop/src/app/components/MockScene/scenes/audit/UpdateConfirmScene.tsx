import { useEffect, useState } from 'react';
import { ToastProvider } from '../../../Toast';
import { UpdatePill } from '../../../../../features/updater/components/UpdatePill';
import { useAppStore } from '../../../../../store';
import { sceneParam } from './sceneParams';

const STATE = sceneParam({ key: 'state' }) ?? 'available';

export const UpdateConfirmScene = () => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    useAppStore.setState({
      updaterStatus: STATE === 'ready' ? 'ready' : 'available',
      updateVersion: '0.3.14',
      applyUpdate: async () => undefined,
    });
    setIsReady(true);
  }, []);
  useEffect(() => {
    if (!isReady) {
      return;
    }
    const timer = window.setTimeout(() => {
      document.querySelector<HTMLButtonElement>('[data-testid="update-pill"]')?.click();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [isReady]);
  if (!isReady) {
    return null;
  }
  return (
    <ToastProvider>
      <main className="flex h-screen flex-col bg-background text-foreground">
        <div className="flex h-9 items-center justify-end border-b border-border px-3">
          <UpdatePill />
        </div>
      </main>
    </ToastProvider>
  );
};

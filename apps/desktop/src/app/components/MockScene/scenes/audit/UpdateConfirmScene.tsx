import { useEffect, useState } from 'react';
import { ToastProvider } from '../../../Toast';
import { UpdateIndicator } from '../../../../../features/updater/components/UpdateIndicator';
import { useAppStore } from '../../../../../store';

export const UpdateConfirmScene = () => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    useAppStore.setState({
      updaterStatus: 'available',
      updateVersion: '0.3.14',
      installUpdate: async () => undefined,
    });
    setIsReady(true);
  }, []);
  useEffect(() => {
    if (!isReady) {
      return;
    }
    const timer = window.setTimeout(() => {
      document.querySelector<HTMLButtonElement>('[data-testid="update-indicator"]')?.click();
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
          <UpdateIndicator variant="pip" />
        </div>
      </main>
    </ToastProvider>
  );
};

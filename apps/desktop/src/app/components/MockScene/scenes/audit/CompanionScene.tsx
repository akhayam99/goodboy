import { useEffect, useState } from 'react';
import { mockIPC } from '@tauri-apps/api/mocks';
import { CompanionStudio } from '../../../../../features/companion/components/CompanionStudio';
import { sceneParam } from './sceneParams';

const noop = () => undefined;

const VARIANT = sceneParam({ key: 'v' }) ?? 'paired';
const PAIRING_PORT = 47821;

const QR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 21 21"><rect width="21" height="21" fill="white"/><path d="M0 0h7v7H0zM14 0h7v7h-7zM0 14h7v7H0z" fill="black"/><path d="M2 2h3v3H2zM16 2h3v3h-3zM2 16h3v3H2z" fill="white"/><path d="M9 1h2v2H9zM9 5h3v2H9zM8 9h5v1H8zM14 9h2v3h-2zM10 12h2v4h-2zM15 15h4v2h-4zM13 18h2v3h-2zM18 12h3v2h-3z" fill="black"/></svg>`;

const installIpc = (): void => {
  mockIPC((cmd) => {
    if (cmd === 'bridge_start') {
      if (VARIANT === 'error') {
        throw new Error(`Could not bind the pairing port ${PAIRING_PORT}, it is already in use`);
      }
      return {
        payload: 'goodboy://pair?mock',
        svg: QR_SVG,
        deviceName: 'Harborline MacBook',
        port: PAIRING_PORT,
        expiresInSecs: 120,
      };
    }
    if (cmd === 'bridge_status') {
      return { running: true, port: PAIRING_PORT, enrolledCount: VARIANT === 'paired' ? 1 : 0 };
    }
    return null;
  });
};

export const CompanionScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    installIpc();
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <main className="h-screen bg-background text-foreground">
      <CompanionStudio onClose={noop} />
    </main>
  );
};

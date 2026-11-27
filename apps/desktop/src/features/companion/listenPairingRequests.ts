import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import { isMainWindow } from '../workspace/window';
import type { PendingPairing } from './bridge';

export const PAIRING_REQUEST_EVENT = 'bridge://pairing-request';

const NOTICE_TITLE = 'An iPhone wants to pair';
const NOTICE_BODY = 'Open Settings, iPhone to allow or deny it.';

const isGranted = async (): Promise<boolean> => {
  if (await isPermissionGranted()) {
    return true;
  }
  return (await requestPermission()) === 'granted';
};

const notify = async (): Promise<void> => {
  if (document.hasFocus()) {
    return;
  }
  if (!(await isGranted())) {
    return;
  }
  sendNotification({ title: NOTICE_TITLE, body: NOTICE_BODY });
};

export const listenPairingRequests = async (): Promise<UnlistenFn> => {
  if (!isMainWindow()) {
    return () => undefined;
  }
  return listen<PendingPairing>(PAIRING_REQUEST_EVENT, () => {
    void notify().catch((error: unknown) => {
      console.error('[bridge] pairing notification failed', error);
    });
  });
};

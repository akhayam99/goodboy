import { invoke } from '@tauri-apps/api/core';

export type QrInfo = {
  payload: string;
  svg: string;
  deviceName: string;
  port: number;
  expiresInSecs: number;
};

export type BridgeStatus = {
  running: boolean;
  port: number | null;
  enrolledCount: number;
};

/** Starts the companion bridge (idempotent) and mints a fresh pairing QR. */
export const bridgeStart = (): Promise<QrInfo> => invoke<QrInfo>('bridge_start');

/** Stops the companion bridge and drops the accept loop. */
export const bridgeStop = (): Promise<void> => invoke<void>('bridge_stop');

/**
 * Desktop-initiated disconnect: forgets every paired phone and tears the bridge
 * down (any live connection is dropped). The phone must re-scan a QR to pair
 * again — the desktop-side twin of the phone's own "Forget device".
 */
export const bridgeRevoke = (): Promise<void> => invoke<void>('bridge_revoke');

export const bridgeStatus = (): Promise<BridgeStatus> => invoke<BridgeStatus>('bridge_status');

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

export const bridgeStart = (): Promise<QrInfo> => invoke<QrInfo>('bridge_start');

export const bridgeStop = (): Promise<void> => invoke<void>('bridge_stop');

export const bridgeRevoke = (): Promise<void> => invoke<void>('bridge_revoke');

export const bridgeStatus = (): Promise<BridgeStatus> => invoke<BridgeStatus>('bridge_status');

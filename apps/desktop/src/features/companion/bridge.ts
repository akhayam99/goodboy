import { invokeCommand } from '../../shared/lib/invokeCommand';

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

export const bridgeStart = (): Promise<QrInfo> => invokeCommand<QrInfo>('bridge_start');

export const bridgeRevoke = (): Promise<void> => invokeCommand<void>('bridge_revoke');

export const bridgeStop = (): Promise<void> => invokeCommand<void>('bridge_stop');

export const bridgeStatus = (): Promise<BridgeStatus> =>
  invokeCommand<BridgeStatus>('bridge_status');

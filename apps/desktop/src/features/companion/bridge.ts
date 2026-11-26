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

export type PhonePermissions = {
  readonly canDecide: boolean;
  readonly canMerge: boolean;
  readonly canStart: boolean;
};

export type PairedPhone = {
  readonly id: string;
  readonly name: string;
  readonly pairedAt: string;
  readonly lastSeen: string | null;
  readonly permissions: PhonePermissions;
};

export type NetworkInterface = {
  readonly name: string;
  readonly addresses: ReadonlyArray<string>;
  readonly isSelected: boolean;
};

type SetInterfacesParams = {
  readonly names: ReadonlyArray<string>;
};

type SetPermissionsParams = {
  readonly phoneId: string;
  readonly permissions: PhonePermissions;
};

type RevokePhoneParams = {
  readonly phoneId: string;
};

export const NO_PRIVATE_NETWORK_KIND = 'no_private_network';

export const bridgeStart = (): Promise<QrInfo> => invokeCommand<QrInfo>('bridge_start');

export const bridgeRevoke = (): Promise<void> => invokeCommand<void>('bridge_revoke');

export const bridgeStop = (): Promise<void> => invokeCommand<void>('bridge_stop');

export const bridgeStatus = (): Promise<BridgeStatus> =>
  invokeCommand<BridgeStatus>('bridge_status');

export const bridgePhones = (): Promise<ReadonlyArray<PairedPhone>> =>
  invokeCommand<ReadonlyArray<PairedPhone>>('bridge_phones');

export const bridgeInterfaces = (): Promise<ReadonlyArray<NetworkInterface>> =>
  invokeCommand<ReadonlyArray<NetworkInterface>>('bridge_interfaces');

export const bridgeSetInterfaces = ({ names }: SetInterfacesParams): Promise<void> =>
  invokeCommand<void>('bridge_set_interfaces', { names });

export const bridgeSetPermissions = ({
  phoneId,
  permissions,
}: SetPermissionsParams): Promise<void> =>
  invokeCommand<void>('bridge_set_permissions', { phoneId, permissions });

export const bridgeRevokePhone = ({ phoneId }: RevokePhoneParams): Promise<void> =>
  invokeCommand<void>('bridge_revoke_phone', { phoneId });

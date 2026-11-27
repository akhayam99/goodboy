import type { PermissionRuleId } from '@goodboy/types';
import { invokeCommand } from '../../shared/lib/invokeCommand';

export type QrInfo = {
  payload: string;
  svg: string;
  deviceName: string;
  port: number;
  expiresInSecs: number;
};

export type PendingPairing = {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly askedAt: string;
};

export type BridgeFault = {
  readonly code: 'file_unreadable' | 'keychain_unavailable' | 'key_mismatch';
  readonly message: string;
};

export type BridgeStatus = {
  running: boolean;
  port: number | null;
  enrolledCount: number;
  isAdvertised: boolean;
  pendingPairing: PendingPairing | null;
  fault: BridgeFault | null;
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
  readonly liveSince: string | null;
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

type PairingDecisionParams = {
  readonly id: string;
  readonly isAllowed: boolean;
};

type LinkQrParams = {
  readonly link: string;
};

type RevokePhoneParams = {
  readonly phoneId: string;
};

export const NO_PRIVATE_NETWORK_KIND = 'no_private_network';

export const bridgeStart = (): Promise<QrInfo> => invokeCommand<QrInfo>('bridge_start');

export const bridgeRevoke = (): Promise<ReadonlyArray<PermissionRuleId>> =>
  invokeCommand<ReadonlyArray<PermissionRuleId>>('bridge_revoke');

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

export const bridgeRevokePhone = ({
  phoneId,
}: RevokePhoneParams): Promise<ReadonlyArray<PermissionRuleId>> =>
  invokeCommand<ReadonlyArray<PermissionRuleId>>('bridge_revoke_phone', { phoneId });

type NotePhoneRuleParams = {
  readonly phoneId: string;
  readonly ruleId: string;
};

export const bridgeNotePhoneRule = ({ phoneId, ruleId }: NotePhoneRuleParams): Promise<boolean> =>
  invokeCommand<boolean>('bridge_note_phone_rule', { phoneId, ruleId });

export const bridgePairingDecide = ({ id, isAllowed }: PairingDecisionParams): Promise<boolean> =>
  invokeCommand<boolean>('bridge_pairing_decide', { id, isAllowed });

export const bridgeResetPairing = (): Promise<void> => invokeCommand<void>('bridge_reset_pairing');

export const bridgeLinkQr = ({ link }: LinkQrParams): Promise<string> =>
  invokeCommand<string>('bridge_link_qr', { link });

export const bridgeCancelCode = (): Promise<void> => invokeCommand<void>('bridge_cancel_code');

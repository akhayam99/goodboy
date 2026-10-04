import type { ProviderDisplayInfo } from '../../../../providers';

export type AccountConfirm = 'none' | 'reauth' | 'disconnect';

export type AccountGroupProps = {
  readonly info: ProviderDisplayInfo;
  readonly planLabel: string | null;
  readonly canReauth: boolean;
  readonly autoUpdate: boolean;
  readonly confirm: AccountConfirm;
  readonly onConfirmChange: (next: AccountConfirm) => void;
  readonly onReauth: () => void;
  readonly onConfirmReauth: () => void;
  readonly onDisconnect: () => void;
};

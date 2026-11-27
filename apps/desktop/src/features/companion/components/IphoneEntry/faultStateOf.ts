import type { BridgeFault } from '../../bridge';

type Params = {
  readonly fault: BridgeFault;
};

export const faultStateOf = ({ fault }: Params): string => {
  if (fault.code === 'keychain_unavailable') {
    return 'Keychain unavailable';
  }
  if (fault.code === 'key_mismatch') {
    return "Keys don't match";
  }
  return 'Keys unreadable';
};

import type { Tone } from '@goodboy/ui';
import type { IntegrationKeyCheck } from '../../../store/slices/integrations/state';

export type ToolStateKind = 'notSetUp' | 'checking' | 'connected' | 'keyMissing';

export type ToolState = {
  readonly kind: ToolStateKind;
  readonly word: string;
  readonly tone: Tone;
};

type Params = {
  readonly isConnected: boolean;
  readonly hasKey: boolean;
  readonly keyCheck: IntegrationKeyCheck | null;
};

const STATES: Readonly<Record<ToolStateKind, ToolState>> = {
  notSetUp: { kind: 'notSetUp', word: 'Not set up', tone: 'neutral' },
  checking: { kind: 'checking', word: 'Checking', tone: 'neutral' },
  connected: { kind: 'connected', word: 'Connected', tone: 'neutral' },
  keyMissing: { kind: 'keyMissing', word: 'Key missing', tone: 'danger' },
};

export const toolStateOf = ({ isConnected, hasKey, keyCheck }: Params): ToolState => {
  if (!isConnected) {
    return STATES.notSetUp;
  }
  if (!hasKey) {
    return STATES.connected;
  }
  if (keyCheck === null) {
    return STATES.checking;
  }
  return keyCheck.isPresent ? STATES.connected : STATES.keyMissing;
};

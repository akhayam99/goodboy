import type { ProviderConnectPhase } from '../../../../store/slices/providers';
import { connectView } from './connectView';

type Params = {
  readonly phase: ProviderConnectPhase;
};

export const isConnectRunning = ({ phase }: Params): boolean =>
  connectView({ phase, step: null, providerLabel: '', identity: null, chrome: 'inline' }).isRunning;

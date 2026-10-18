import type { ProviderActionTarget } from '../../../../../actions/types';
import type { ProviderDisplayInfo } from '../../../../providers';

export type AccountGroupProps = {
  readonly info: ProviderDisplayInfo;
  readonly planLabel: string | null;
  readonly autoUpdate: boolean;
  readonly target: ProviderActionTarget;
  readonly isHistoryOpen: boolean;
  readonly onCloseHistory: () => void;
};

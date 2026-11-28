import type { ChipCall } from './callChipTypes';
import { useCallChipView } from './hooks/useCallChipView';

type ShowFailedParams = {
  readonly call: ChipCall;
  readonly error: unknown;
};

type Props = {
  readonly onShowFailed: (params: ShowFailedParams) => void;
};

export const CallChipViewSync = ({ onShowFailed }: Props) => {
  useCallChipView({ onShowFailed });
  return null;
};

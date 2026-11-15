import { flowWordOf, type FlowWord } from '../../lib/flowWordOf';
import { useIsWorkOn } from '../useIsWorkOn';

export const useFlowWord = (): FlowWord => {
  const isWork = useIsWorkOn();
  return flowWordOf({ isWork });
};

import { useAppStore } from '../../../../store';
import { selectLiveWork, type LiveWork } from '../../../../store/slices/live-work/selectLiveWork';

type CountParams = {
  readonly liveWork: LiveWork;
};

export const countLiveWork = ({ liveWork }: CountParams): number =>
  liveWork.runningAgentIds.length +
  liveWork.blockedAgentIds.length +
  liveWork.decidingRunIds.length;

export const useRunningAgentCount = (): number =>
  useAppStore((state) => countLiveWork({ liveWork: selectLiveWork({ state }) }));

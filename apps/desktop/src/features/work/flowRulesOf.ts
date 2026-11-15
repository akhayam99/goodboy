import { flowWordOf, type FlowWord } from '../../shared/lib/flowWordOf';
import { NAMES } from '../../shared/utils/names';

export type FlowRules = Readonly<{
  hasWorkSection: boolean;
  word: FlowWord;
  shouldStartOpenComposer: boolean;
  startLabel: string;
  autonomyControl: 'level-chip' | 'rows-panel';
  hasPermissionRows: boolean;
  isMessageDeliveredAtOnce: boolean;
  canLeadCloseItsWork: boolean;
  savedPlaceOnWork: 'board' | 'work';
}>;

type Params = {
  readonly isWork: boolean;
};

export const flowRulesOf = ({ isWork }: Params): FlowRules => ({
  hasWorkSection: isWork,
  word: flowWordOf({ isWork }),
  shouldStartOpenComposer: isWork,
  startLabel: isWork ? NAMES.startWork : NAMES.startARun,
  autonomyControl: isWork ? 'rows-panel' : 'level-chip',
  hasPermissionRows: isWork,
  isMessageDeliveredAtOnce: isWork,
  canLeadCloseItsWork: isWork,
  savedPlaceOnWork: isWork ? 'work' : 'board',
});

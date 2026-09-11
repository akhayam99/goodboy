import type { SessionGroupKey, SessionPrGroup, SessionStage } from '@goodboy/types';
import { SESSION_STAGE_META, describeStageBucket } from '../../../session/session-stage';
import { PR_GROUP_PRESENTATION } from '../../../../shared/pullRequestPresentation';
import type { StatePresentation } from '../../../../shared/utils/statePresentation';

type Params = {
  readonly key: string;
  readonly groupMode: SessionGroupKey;
};

const isStage = (key: string): key is SessionStage => key in SESSION_STAGE_META;

const isPrGroup = (key: string): key is SessionPrGroup => key in PR_GROUP_PRESENTATION;

export const sessionGroupPresentation = ({ key, groupMode }: Params): StatePresentation | null => {
  if (groupMode === 'stage' && isStage(key)) {
    return describeStageBucket({ stage: key });
  }
  if (groupMode === 'pr' && isPrGroup(key)) {
    return PR_GROUP_PRESENTATION[key];
  }
  return null;
};

import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { AskLine } from '../../../../../shared/components/AskLine';
import { branchEntriesOf, type BranchDetailWords } from '../../../central/branches/branchStoryOf';
import { useBranchFacts } from '../../../central/branches/useBranchFacts';
import type { LiveGroupModel } from '../../../central/now/liveGroupsOf';
import type { DoingBranch } from '../../doingAnswerOf';
import { useSessionAskLine } from '../../hooks/useSessionAskLine';

type Props = {
  readonly sessionId: SessionId;
};

const NO_GROUPS: ReadonlyArray<LiveGroupModel> = [];
const NO_DETAILS: ReadonlyMap<string, BranchDetailWords> = new Map();

export const SessionAskLine = ({ sessionId }: Props) => {
  const { facts } = useBranchFacts({ sessionId, groups: NO_GROUPS });
  const branches = useMemo(
    (): ReadonlyArray<DoingBranch> =>
      branchEntriesOf({ facts, detailByMountId: NO_DETAILS }).live.map((entry) => ({
        project: entry.fact.projectName,
        branch: entry.fact.branch,
        word: entry.story.word,
      })),
    [facts],
  );
  const line = useSessionAskLine({ sessionId, branches });
  return (
    <AskLine
      starters={line.starters}
      answer={line.answer}
      message={line.message}
      onAsk={line.ask}
      onClose={line.close}
      onOpenInAsk={line.openInAsk}
    />
  );
};

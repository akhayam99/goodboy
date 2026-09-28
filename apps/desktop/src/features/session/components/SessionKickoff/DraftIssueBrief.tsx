import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectIssueBrief } from '../../../../store/slices/issue-briefs/selectIssueBrief';
import { issueBriefKey } from '../../../../store/slices/issue-briefs/issueBriefKey';
import type { IssueCandidate } from '../../../integrations/fetchIssueCandidates';
import { IssueBriefProposal } from './IssueBriefProposal';
import { issueBriefSource } from './issueBriefSource';

type ApplyParams = {
  readonly title: string;
  readonly goal: string;
};

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly candidate: IssueCandidate;
  readonly onStart: (params: ApplyParams) => void;
  readonly onDismiss: () => void;
};

export const DraftIssueBrief = ({ workspaceId, candidate, onStart, onDismiss }: Props) => {
  const requestIssueBrief = useAppStore((state) => state.requestIssueBrief);
  const source = issueBriefSource({ candidate });
  const entry = useAppStore((state) => selectIssueBrief({ state, key: issueBriefKey({ source }) }));
  const verbatimGoal = candidate.goal.trim();

  return (
    <IssueBriefProposal
      source={source}
      entry={entry}
      verbatimGoal={verbatimGoal}
      isTitleLocked={false}
      onApply={onStart}
      onUseTitle={({ title }) => onStart({ title, goal: verbatimGoal })}
      onUseIssueText={() => onStart({ title: candidate.title, goal: verbatimGoal })}
      onRetry={() =>
        void requestIssueBrief({ source, workspaceId, sessionId: null, isRetry: true })
      }
      onDismiss={onDismiss}
    />
  );
};

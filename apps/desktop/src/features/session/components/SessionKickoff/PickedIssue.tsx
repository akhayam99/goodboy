import { Button } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectIssueBrief } from '../../../../store/slices/issue-briefs/selectIssueBrief';
import { issueBriefKey } from '../../../../store/slices/issue-briefs/issueBriefKey';
import type { IssueCandidate } from '../../../integrations/fetchIssueCandidates';
import { HowToWorkOnIt } from './HowToWorkOnIt';
import { IssueBriefProposal } from './IssueBriefProposal';
import { issueBriefSource } from './issueBriefSource';
import { usePickedIssueText } from './usePickedIssueText';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly candidate: IssueCandidate;
  readonly onDismiss: () => void;
};

export const PickedIssue = ({ workspaceId, candidate, onDismiss }: Props) => {
  const requestIssueBrief = useAppStore((state) => state.requestIssueBrief);
  const source = issueBriefSource({ candidate });
  const entry = useAppStore((state) => selectIssueBrief({ state, key: issueBriefKey({ source }) }));
  const text = usePickedIssueText({ candidate, source, entry });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-h-7 items-center gap-2 px-1">
        <span className="shrink-0 text-meta text-muted-foreground tabular-nums">
          {candidate.identifier}
        </span>
        <span className="min-w-0 flex-1 truncate text-body text-foreground">{candidate.title}</span>
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
      <IssueBriefProposal
        source={source}
        entry={entry}
        title={text.title}
        hasBrief={text.hasBrief}
        isBriefShown={text.isBriefShown}
        onTitleChange={text.setTitle}
        onUseBrief={text.applyBrief}
        onUseIssueText={text.applyIssueText}
        onRetry={() =>
          void requestIssueBrief({ source, workspaceId, sessionId: null, isRetry: true })
        }
      />
      <HowToWorkOnIt
        workspaceId={workspaceId}
        candidate={candidate}
        title={text.title}
        goal={text.goal}
        onGoalChange={text.setGoal}
      />
    </div>
  );
};

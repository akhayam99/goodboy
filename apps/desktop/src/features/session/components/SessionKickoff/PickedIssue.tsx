import { Button } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectIssueBrief } from '../../../../store/slices/issue-briefs/selectIssueBrief';
import { issueBriefKey } from '../../../../store/slices/issue-briefs/issueBriefKey';
import { draftIssueKey } from '../../../../store/slices/sessionDraft/draftIssueKey';
import type { IssueCandidate } from '../../../integrations/fetchIssueCandidates';
import { HowToWorkOnIt } from './HowToWorkOnIt';
import { IssueBriefProposal } from './IssueBriefProposal';
import { issueBriefSources } from './issueBriefSources';
import { PickedIssueRow } from './PickedIssueRow';
import { usePickedIssueText } from './usePickedIssueText';

type RemoveParams = {
  readonly key: string;
};

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly candidates: ReadonlyArray<IssueCandidate>;
  readonly onRemove: (params: RemoveParams) => void;
  readonly onAddAnother: () => void;
};

export const PickedIssue = ({ workspaceId, candidates, onRemove, onAddAnother }: Props) => {
  const requestIssueBrief = useAppStore((state) => state.requestIssueBrief);
  const sources = issueBriefSources({ candidates });
  const entry = useAppStore((state) =>
    selectIssueBrief({ state, key: issueBriefKey({ sources }) }),
  );
  const text = usePickedIssueText({ candidates, sources, entry });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <ul aria-label="Picked issues" className="flex flex-col">
          {candidates.map((candidate, index) => {
            const key = draftIssueKey({ candidate });
            return (
              <PickedIssueRow
                key={key}
                candidate={candidate}
                isBranchNamer={index === 0 && candidates.length > 1}
                onRemove={() => onRemove({ key })}
              />
            );
          })}
        </ul>
        <div className="flex px-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={onAddAnother}
          >
            Add another issue
          </Button>
        </div>
      </div>
      <IssueBriefProposal
        sources={sources}
        entry={entry}
        title={text.title}
        hasBrief={text.hasBrief}
        isBriefShown={text.isBriefShown}
        onTitleChange={text.setTitle}
        onUseBrief={text.applyBrief}
        onUseIssueText={text.applyIssueText}
        onRetry={() =>
          void requestIssueBrief({ sources, workspaceId, sessionId: null, isRetry: true })
        }
      />
      <HowToWorkOnIt
        workspaceId={workspaceId}
        candidates={candidates}
        title={text.title}
        goal={text.goal}
        onGoalChange={text.setGoal}
      />
    </div>
  );
};

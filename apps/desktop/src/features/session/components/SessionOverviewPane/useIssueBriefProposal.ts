import { useState } from 'react';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectIssueBrief } from '../../../../store/slices/issue-briefs/selectIssueBrief';
import { issueBriefKey } from '../../../../store/slices/issue-briefs/issueBriefKey';
import type {
  IssueBriefEntry,
  IssueBriefSource,
} from '../../../../store/slices/issue-briefs/types';
import { clampTitle } from '../../../../store/slices/sessions/titleLimit';
import type { IssueCandidate } from '../../../integrations/fetchIssueCandidates';
import { issueBriefSource } from '../SessionKickoff/issueBriefSource';

type Params = {
  readonly session: Session;
};

type Picked = {
  readonly source: IssueBriefSource;
  readonly verbatimTitle: string;
  readonly verbatimGoal: string;
};

type ApplyParams = {
  readonly title: string;
  readonly goal: string;
};

type Proposal = {
  readonly source: IssueBriefSource;
  readonly entry: IssueBriefEntry | null;
  readonly verbatimGoal: string;
  readonly isTitleLocked: boolean;
  readonly onApply: (params: ApplyParams) => void;
  readonly onUseTitle: (params: Pick<ApplyParams, 'title'>) => void;
  readonly onUseIssueText: () => void;
  readonly onRetry: () => void;
  readonly onDismiss: () => void;
};

type PickParams = {
  readonly candidate: IssueCandidate;
};

type Result = {
  readonly proposal: Proposal | null;
  readonly pickIssue: (params: PickParams) => void;
};

export const useIssueBriefProposal = ({ session }: Params): Result => {
  const sessionId = session.id;
  const [picked, setPicked] = useState<Picked | null>(null);
  const requestIssueBrief = useAppStore((s) => s.requestIssueBrief);
  const upsertSessionSlot = useAppStore((s) => s.upsertSessionSlot);
  const renameTask = useAppStore((s) => s.renameTask);
  const reportError = useAppStore((s) => s.reportError);
  const entry = useAppStore((s) =>
    selectIssueBrief({
      state: s,
      key: picked === null ? null : issueBriefKey({ source: picked.source }),
    }),
  );

  const rename = ({ title }: Pick<ApplyParams, 'title'>) => {
    renameTask(sessionId, title).catch((error: unknown) =>
      reportError({ title: "Couldn't rename the session", error, sessionId }),
    );
  };

  const apply = ({ title, goal }: ApplyParams) => {
    setPicked(null);
    void upsertSessionSlot(sessionId, 'goal', goal);
    if (!session.titleUserEdited && title.trim() !== '' && title !== session.goal) {
      rename({ title });
    }
  };

  const pickIssue = ({ candidate }: PickParams) => {
    const source = issueBriefSource({ candidate });
    setPicked({
      source,
      verbatimTitle: clampTitle(`[${candidate.identifier}] ${candidate.title}`),
      verbatimGoal: candidate.goal.trim(),
    });
    void requestIssueBrief({ source, workspaceId: session.workspaceId, sessionId });
  };

  if (picked === null) {
    return { proposal: null, pickIssue };
  }

  return {
    pickIssue,
    proposal: {
      source: picked.source,
      entry,
      verbatimGoal: picked.verbatimGoal,
      isTitleLocked: session.titleUserEdited,
      onApply: apply,
      onUseTitle: rename,
      onUseIssueText: () => apply({ title: picked.verbatimTitle, goal: picked.verbatimGoal }),
      onRetry: () =>
        void requestIssueBrief({
          source: picked.source,
          workspaceId: session.workspaceId,
          sessionId,
          isRetry: true,
        }),
      onDismiss: () => setPicked(null),
    },
  };
};

import { useEffect, useRef, useState } from 'react';
import type {
  IssueBriefEntry,
  IssueBriefSource,
} from '../../../../../store/slices/issue-briefs/types';
import { briefGoalText } from '../../../../integrations/shared/briefGoalText';
import type { IssueCandidate } from '../../../../integrations/fetchIssueCandidates';

type Text = {
  readonly title: string;
  readonly goal: string;
};

type Params = {
  readonly candidate: IssueCandidate;
  readonly source: IssueBriefSource;
  readonly entry: IssueBriefEntry | null;
};

type Result = Text & {
  readonly setTitle: (title: string) => void;
  readonly setGoal: (goal: string) => void;
  readonly hasBrief: boolean;
  readonly isBriefShown: boolean;
  readonly applyBrief: () => void;
  readonly applyIssueText: () => void;
};

const isSame = (left: Text, right: Text): boolean =>
  left.title === right.title && left.goal === right.goal;

export const usePickedIssueText = ({ candidate, source, entry }: Params): Result => {
  const verbatim: Text = { title: candidate.title, goal: candidate.goal.trim() };
  const brief: Text | null =
    entry?.status === 'ready'
      ? { title: entry.brief.title, goal: briefGoalText({ brief: entry.brief, source }) }
      : null;
  const [text, setText] = useState<Text>(verbatim);
  const seeded = useRef<Text>(verbatim);
  const isPinned = useRef(false);
  const briefTitle = brief?.title ?? null;
  const briefGoal = brief?.goal ?? null;

  useEffect(() => {
    if (briefTitle === null || briefGoal === null || isPinned.current) {
      return;
    }
    const next: Text = { title: briefTitle, goal: briefGoal };
    const previous = seeded.current;
    setText((current) => (isSame(current, previous) ? next : current));
    seeded.current = next;
  }, [briefGoal, briefTitle]);

  const apply = (next: Text): void => {
    seeded.current = next;
    setText(next);
  };

  return {
    ...text,
    setTitle: (title) => setText((current) => ({ ...current, title })),
    setGoal: (goal) => setText((current) => ({ ...current, goal })),
    hasBrief: brief !== null,
    isBriefShown: brief !== null && isSame(text, brief),
    applyBrief: () => {
      if (brief !== null) {
        isPinned.current = false;
        apply(brief);
      }
    },
    applyIssueText: () => {
      isPinned.current = true;
      apply(verbatim);
    },
  };
};

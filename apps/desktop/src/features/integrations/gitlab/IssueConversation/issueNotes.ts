import type { GitlabIssueNote } from '../client';

type Params = {
  readonly notes: ReadonlyArray<GitlabIssueNote>;
};

export type IssueConversation = {
  readonly notes: ReadonlyArray<GitlabIssueNote>;
  readonly systemNoteCount: number;
};

export const buildIssueConversation = ({ notes }: Params): IssueConversation => {
  const visible: GitlabIssueNote[] = [];
  let systemNoteCount = 0;

  for (const note of notes) {
    if (note.system) {
      systemNoteCount += 1;
      continue;
    }
    visible.push(note);
  }

  return {
    notes: visible.sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    systemNoteCount,
  };
};

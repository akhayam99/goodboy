import type { GitlabMrDiscussion, GitlabMrNote } from '../../client';

type Params = {
  readonly discussions: ReadonlyArray<GitlabMrDiscussion>;
};

export type MrThread = {
  readonly id: string;
  readonly head: GitlabMrNote;
  readonly replies: ReadonlyArray<GitlabMrNote>;
  readonly filePath: string | null;
  readonly isResolved: boolean;
};

export type MrConversation = {
  readonly threads: ReadonlyArray<MrThread>;
  readonly systemNoteCount: number;
};

type NoteParams = {
  readonly note: GitlabMrNote;
};

type AnchorParams = {
  readonly thread: MrThread;
};

const filePathOf = ({ note }: NoteParams): string | null => {
  const position = note.position;
  if (position == null) {
    return null;
  }
  const path = position.newPath ?? position.oldPath;
  return path != null && path !== '' ? path : null;
};

const lineOf = ({ note }: NoteParams): number | null => {
  const position = note.position;
  if (position == null) {
    return null;
  }
  return position.newLine ?? position.oldLine;
};

export const threadAnchor = ({ thread }: AnchorParams): string | null => {
  if (thread.filePath == null) {
    return null;
  }
  const line = lineOf({ note: thread.head });
  return line == null ? thread.filePath : `${thread.filePath}:${line}`;
};

export const buildMrConversation = ({ discussions }: Params): MrConversation => {
  const threads: MrThread[] = [];
  let systemNoteCount = 0;

  for (const discussion of discussions) {
    const notes = discussion.notes.filter((note) => {
      if (note.system) {
        systemNoteCount += 1;
        return false;
      }
      return true;
    });
    const [head, ...replies] = notes;
    if (head === undefined) {
      continue;
    }
    const resolvable = notes.filter((note) => note.resolvable);
    threads.push({
      id: discussion.id,
      head,
      replies,
      filePath: filePathOf({ note: head }),
      isResolved: resolvable.length > 0 && resolvable.every((note) => note.resolved === true),
    });
  }

  return {
    threads: threads.sort((left, right) => right.head.createdAt.localeCompare(left.head.createdAt)),
    systemNoteCount,
  };
};

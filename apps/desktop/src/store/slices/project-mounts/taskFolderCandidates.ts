import type { Project, ProjectId } from '@goodboy/types';

type NamedParams = {
  readonly text: string;
  readonly name: string;
};

const isNameChar = (char: string | undefined): boolean => {
  if (char === undefined) {
    return false;
  }
  const code = char.charCodeAt(0);
  const isDigit = code >= 48 && code <= 57;
  const isLower = code >= 97 && code <= 122;
  return isDigit || isLower || char === '-' || char === '_';
};

const SHORT_NAME_LENGTH = 4;

type MarkedParams = {
  readonly text: string;
  readonly from: number;
  readonly end: number;
};

const isMarkedName = ({ text, from, end }: MarkedParams): boolean => {
  const isQuoted = text[from - 1] === '`' && text[end] === '`';
  const isOwnerPath = text[from - 1] === '/' && isNameChar(text[from - 2]);
  return isQuoted || isOwnerPath;
};

const isNamedIn = ({ text, name }: NamedParams): boolean => {
  if (name === '') {
    return false;
  }
  const isShort = name.length < SHORT_NAME_LENGTH;
  let from = text.indexOf(name);
  while (from !== -1) {
    const end = from + name.length;
    const isStartBound = !isNameChar(text[from - 1]);
    const isEndBound = !isNameChar(text[end]);
    const isMarked = !isShort || isMarkedName({ text, from, end });
    if (isStartBound && isEndBound && isMarked) {
      return true;
    }
    from = text.indexOf(name, from + 1);
  }
  return false;
};

type CandidateParams = {
  readonly projects: ReadonlyArray<Project>;
  readonly pinnedProjectIds: ReadonlyArray<ProjectId>;
  readonly linkedProjectIds: ReadonlyArray<ProjectId>;
  readonly text: string;
};

export const taskFolderCandidates = ({
  projects,
  pinnedProjectIds,
  linkedProjectIds,
  text,
}: CandidateParams): ReadonlyArray<Project> => {
  if (pinnedProjectIds.length > 0) {
    return [];
  }
  const connected = projects.filter((project) => project.disconnectedAt === undefined);
  const only = connected[0];
  if (connected.length === 1 && only !== undefined) {
    return [only];
  }
  const lowered = text.toLowerCase();
  const linked = connected.filter((project) => linkedProjectIds.includes(project.id));
  const named = connected.filter(
    (project) =>
      !linkedProjectIds.includes(project.id) &&
      isNamedIn({ text: lowered, name: project.name.toLowerCase() }),
  );
  return [...linked, ...named];
};

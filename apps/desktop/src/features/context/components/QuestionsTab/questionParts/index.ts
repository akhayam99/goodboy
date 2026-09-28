export type QuestionParts = {
  readonly title: string;
  readonly context: string;
  readonly files: ReadonlyArray<string>;
};

type Params = {
  readonly text: string;
};

const HEADING_MARK = /^#{1,6}\s+/;
const CODE_SPAN = /`([^`\n]+)`/g;
const FILE_PATH =
  /^[\w@.-]+(?:\/[\w@.-]+)+\.\w{1,6}$|^[\w-]+\.(?:ts|tsx|js|jsx|rs|py|go|md|json|toml|yaml|yml|sql|css|html)$/;

const filesIn = ({ text }: Params): ReadonlyArray<string> => {
  const found: string[] = [];
  for (const match of text.matchAll(CODE_SPAN)) {
    const candidate = (match[1] ?? '').trim();
    if (FILE_PATH.test(candidate) && !found.includes(candidate)) {
      found.push(candidate);
    }
  }
  return found;
};

export const questionParts = ({ text }: Params): QuestionParts => {
  const trimmed = text.trim();
  const breakAt = trimmed.indexOf('\n');
  const files = filesIn({ text: trimmed });
  if (breakAt === -1) {
    return { title: trimmed.replace(HEADING_MARK, ''), context: '', files };
  }
  return {
    title: trimmed.slice(0, breakAt).trim().replace(HEADING_MARK, ''),
    context: trimmed.slice(breakAt + 1).trim(),
    files,
  };
};

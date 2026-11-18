type Params = {
  readonly text: string;
};

const MARKS = ['**', '`'] as const;

const LIST_MARKS = ['- ', '* '] as const;

export const causeSentenceOf = ({ text }: Params): string | null => {
  const line = text
    .split('\n')
    .map((candidate) => candidate.trim())
    .find((candidate) => candidate.length > 0 && !candidate.startsWith('#'));
  if (line === undefined) {
    return null;
  }
  const listMark = LIST_MARKS.find((mark) => line.startsWith(mark));
  const bare = MARKS.reduce(
    (current, mark) => current.split(mark).join(''),
    listMark === undefined ? line : line.slice(listMark.length),
  );
  const end = bare.indexOf('. ');
  return end === -1 ? bare : bare.slice(0, end + 1);
};

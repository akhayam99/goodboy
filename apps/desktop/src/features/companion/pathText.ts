const SEGMENT = String.raw`[^\s/\\'"\x60,;:()<>{}\[\]]+`;
const SEPARATED = String.raw`[\\/]${SEGMENT}`;
const PATH_PATTERN = new RegExp(
  String.raw`(?<![\w.)\]/\\])(?:(?:~|[A-Za-z]:)(?:${SEPARATED})+|(?:${SEPARATED}){2,})`,
  'g',
);

type Params = {
  readonly text: string;
};

const leafOf = ({ text }: Params): string => {
  const parts = text.split(/[\\/]/).filter((part) => part.length > 0);
  return parts[parts.length - 1] ?? '';
};

export const withoutAbsolutePaths = ({ text }: Params): string =>
  text.replace(PATH_PATTERN, (path) => leafOf({ text: path }));

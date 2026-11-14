type Params = {
  readonly text: string;
};

const RAW_ID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const ARTIFACT_WORD = ' artifact ';

const withoutArtifactWord = ({ text }: Params): string => {
  const padded = ` ${text}`;
  return padded.toLowerCase().endsWith(ARTIFACT_WORD)
    ? padded.slice(0, -ARTIFACT_WORD.length + 1)
    : text;
};

export const withoutRawIdsOf = ({ text }: Params): string => {
  let out = '';
  let from = 0;
  for (const match of text.matchAll(RAW_ID)) {
    const at = match.index ?? 0;
    out += withoutArtifactWord({ text: text.slice(from, at) });
    from = at + match[0].length;
  }
  if (from === 0) {
    return text;
  }
  return (out + text.slice(from))
    .split(' ')
    .filter((word) => word !== '')
    .join(' ');
};

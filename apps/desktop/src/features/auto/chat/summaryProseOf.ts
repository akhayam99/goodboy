import { splitArtifactText } from '../../chat/utils/split-artifact-blocks';

type Params = {
  readonly summary: string | null;
};

export const summaryProseOf = ({ summary }: Params): string | null => {
  if (summary === null) {
    return null;
  }
  const prose = splitArtifactText({ text: summary })
    .segments.map((segment) => (segment.kind === 'prose' ? segment.text : ''))
    .join('')
    .trim();
  return prose.length > 0 ? prose : null;
};

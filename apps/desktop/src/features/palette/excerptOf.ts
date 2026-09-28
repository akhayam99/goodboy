type Params = {
  readonly markdown: string;
  readonly limit?: number;
};

export const excerptOf = ({ markdown, limit = 320 }: Params): string => {
  const text = markdown
    .split('\n')
    .map((line) => line.replace(/^\s{0,3}(?:#{1,6}\s+|>\s?|[-*+]\s+|\d+\.\s+)/, '').trim())
    .filter((line) => line !== '')
    .join(' ')
    .replace(/[*_`~]+/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length <= limit ? text : `${text.slice(0, limit).trimEnd()}…`;
};

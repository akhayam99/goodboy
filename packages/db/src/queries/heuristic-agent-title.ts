const CODE_FENCE = '```';

const MAX_TITLE_WORDS = 10;

const MAX_TITLE_LENGTH = 60;

const CLAUSE_END = /[.,;:!?](?:\s|$)|[。．！？；：，、]/;

const LIST_MARKER = /^(?:\d+[.)]|[-+])\s+/;

type PromptParams = {
  readonly prompt: string;
};

const withoutCodeFences = ({ prompt }: PromptParams): string => {
  const parts = prompt.split(CODE_FENCE);
  const isUnclosed = parts.length % 2 === 0;
  return parts
    .filter((_part, index) => index % 2 === 0 || (isUnclosed && index === parts.length - 1))
    .join(' ');
};

const firstLineOf = ({ prompt }: PromptParams): string => {
  const lines = withoutCodeFences({ prompt })
    .slice(0, 600)
    .replace(/`[^`]+`/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[*_#>\[\]]/g, ' ')
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim().replace(LIST_MARKER, ''));
  return lines.find((line) => line.length > 0) ?? '';
};

const firstClauseOf = ({ prompt }: PromptParams): string => {
  const end = prompt.search(CLAUSE_END);
  const clause = end > 0 ? prompt.slice(0, end).trim() : prompt;
  return clause.length > 0 ? clause : prompt;
};

const cutOnWord = ({ prompt }: PromptParams): string => {
  const words = prompt.split(' ').slice(0, MAX_TITLE_WORDS).join(' ');
  if (words.length <= MAX_TITLE_LENGTH) {
    return words;
  }
  const lastSpace = words.lastIndexOf(' ', MAX_TITLE_LENGTH);
  return words.slice(0, lastSpace > 0 ? lastSpace : MAX_TITLE_LENGTH).trimEnd();
};

export const heuristicAgentTitle = ({ prompt }: PromptParams): string | null => {
  const clause = firstClauseOf({ prompt: firstLineOf({ prompt }) });
  const title = cutOnWord({ prompt: clause });
  if (title.length === 0) {
    return null;
  }
  return `${title.charAt(0).toUpperCase()}${title.slice(1)}`;
};

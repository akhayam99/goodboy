type Params = {
  readonly goal: string;
};

const MAX_WORDS = 4;
const MAX_DIRECTORY_NAME_LENGTH = 40;
const CONTROL_CHARACTER_RE = /\p{Cc}/gu;
const RESERVED_CHARACTER_RE = /[\\/:*?"<>|]/g;
const LEADING_DOT_RE = /^\.+/;
const TRAILING_DOT_OR_SPACE_RE = /[. ]+$/;
const DOT_DOT_RE = /\.{2,}/g;

const sanitizeGoal = ({ goal }: Params): string => {
  const cleaned = goal
    .replace(CONTROL_CHARACTER_RE, '')
    .replace(RESERVED_CHARACTER_RE, '')
    .replace(LEADING_DOT_RE, '')
    .replace(DOT_DOT_RE, '.')
    .replace(TRAILING_DOT_OR_SPACE_RE, '')
    .trim();
  if (cleaned === '') {
    return 'session';
  }
  return cleaned;
};

export const deriveDefaultSessionDirectoryNameFromGoal = ({ goal }: Params): string => {
  const cleaned = sanitizeGoal({ goal });
  const tokens = cleaned.match(/\S+|\s+/g) ?? [];
  let selected = '';
  let selectedWordCount = 0;

  for (const token of tokens) {
    const isWhitespace = token.trim() === '';
    if (isWhitespace && selected === '') {
      continue;
    }
    if (!isWhitespace && selectedWordCount >= MAX_WORDS) {
      break;
    }
    const candidate = `${selected}${token}`;
    if (Array.from(candidate).length > MAX_DIRECTORY_NAME_LENGTH) {
      if (selectedWordCount === 0 && !isWhitespace) {
        return Array.from(token).slice(0, MAX_DIRECTORY_NAME_LENGTH).join('');
      }
      break;
    }
    selected = candidate;
    if (!isWhitespace) {
      selectedWordCount += 1;
    }
  }

  selected = selected.replace(TRAILING_DOT_OR_SPACE_RE, '');
  if (selected === '') {
    return 'session';
  }
  return selected;
};

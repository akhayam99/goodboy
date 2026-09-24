type Params = {
  readonly message: string;
};

export type SplitErrorMessage = {
  readonly summary: string | null;
  readonly detail: string | null;
};

const SUMMARY_MAX_CHARS = 160;

const TECHNICAL_PATTERNS = [
  /stderr/i,
  /stdout/i,
  /exit(?:ed)?(?: with)? (?:code|status)/i,
  /os error/i,
  /errno/i,
  /\bsignal\b/i,
  /\bat \S+:\d+/,
  /\b[A-Z]{2,}_[A-Z_]{2,}\b/,
  /\bE[A-Z]{3,}\b/,
  /https?:[/]{2}/,
  /(?:^|\s)[~.]?[/][\w.-]+[/]/,
  /[{}[\]]/,
];

const isTechnical = ({ message }: Params): boolean =>
  message.includes('\n') ||
  message.length > SUMMARY_MAX_CHARS ||
  TECHNICAL_PATTERNS.some((pattern) => pattern.test(message));

export const splitErrorMessage = ({ message }: Params): SplitErrorMessage => {
  const trimmed = message.trim();
  if (trimmed === '') {
    return { summary: null, detail: null };
  }
  if (isTechnical({ message: trimmed })) {
    return { summary: null, detail: trimmed };
  }
  return { summary: trimmed, detail: null };
};

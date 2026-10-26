type Params = {
  readonly lang: string | null;
  readonly content: string;
};

const SHELL_LANGS: ReadonlySet<string> = new Set(['bash', 'sh', 'zsh', 'shell', 'console']);

const PROMPT_LINE = /^\$\s+\S/;

const COMMAND_START =
  /^(?:pnpm|npm|npx|yarn|bun|git|gh|cargo|rustup|node|python3?|pip3?|make|docker|kubectl|brew|curl|cd|ls|cat|echo|export)\s/;

const PROMPT_PREFIX = /^\$\s+/;

const nonEmptyLines = ({ content }: Pick<Params, 'content'>): ReadonlyArray<string> =>
  content.split('\n').filter((line) => line.trim() !== '');

const promptCommands = ({ content }: Pick<Params, 'content'>): string =>
  content
    .split('\n')
    .filter((line) => PROMPT_PREFIX.test(line))
    .map((line) => line.replace(PROMPT_PREFIX, ''))
    .join('\n');

export const shellCommandOf = ({ lang, content }: Params): string | null => {
  const first = nonEmptyLines({ content })[0];
  if (first === undefined) {
    return null;
  }
  const language = lang?.trim().toLowerCase() ?? '';
  if (language !== '' && !SHELL_LANGS.has(language)) {
    return null;
  }
  if (PROMPT_LINE.test(first)) {
    return promptCommands({ content });
  }
  if (language !== '') {
    return content;
  }
  return COMMAND_START.test(first) ? content : null;
};

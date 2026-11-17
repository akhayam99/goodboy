import type { ReplyTemplateVariable } from './renderReplyTemplate';

type Params = {
  readonly text: string;
  readonly caret: number | null;
  readonly name: ReplyTemplateVariable;
};

type CharParams = {
  readonly char: string | undefined;
};

const isWordChar = ({ char }: CharParams): boolean => char !== undefined && /\S/.test(char);

export const insertReplyPlaceholder = ({ text, caret, name }: Params): string => {
  const token = `{${name}}`;
  if (caret === null || caret >= text.length) {
    const head = text.trimEnd();
    return head === '' ? token : `${head} ${token}`;
  }
  const at = Math.max(0, caret);
  const before = text.slice(0, at);
  const after = text.slice(at);
  const lead = isWordChar({ char: before.at(-1) }) ? ' ' : '';
  const trail = isWordChar({ char: after.at(0) }) ? ' ' : '';
  return `${before}${lead}${token}${trail}${after}`;
};

const FENCE = '```';
const FENCE_LANGUAGE = 'json';

type UnwrapParams = {
  readonly text: string;
};

export const unwrapEdgeFence = ({ text }: UnwrapParams): string => {
  if (text.length < FENCE.length * 2 || !text.startsWith(FENCE) || !text.endsWith(FENCE)) {
    return text;
  }
  const inner = text.slice(FENCE.length, -FENCE.length);
  const hasLanguage = inner.slice(0, FENCE_LANGUAGE.length).toLowerCase() === FENCE_LANGUAGE;
  return (hasLanguage ? inner.slice(FENCE_LANGUAGE.length) : inner).trim();
};

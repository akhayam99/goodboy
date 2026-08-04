const URL_RE = /https?:\/\/[^\s<>"'\x00-\x1F]+/g;
const AUTH_HINT_RE =
  /oauth|authoriz|sign[-_]?in|\/login|cli-auth|claude\.|anthropic\.|cursor\.|openai\.|accounts\.google\./i;

type Params = {
  readonly text: string;
};

export const detectAuthUrl = ({ text }: Params): string | null => {
  const matches = text.match(URL_RE);
  if (matches === null) {
    return null;
  }
  for (const url of matches) {
    if (AUTH_HINT_RE.test(url)) {
      return url;
    }
  }
  return null;
};

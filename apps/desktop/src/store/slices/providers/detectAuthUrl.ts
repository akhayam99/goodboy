const URL_RE = /https?:\/\/[^\s<>"'\x00-\x1F]+/g;
const AUTH_HINT_RE =
  /oauth|authoriz|sign[-_]?in|\/login|cli-auth|claude\.|anthropic\.|cursor\.|openai\.|accounts\.google\./i;

type Params = {
  readonly text: string;
};

export const detectAuthUrl = ({ text }: Params): string | null => {
  for (const match of text.matchAll(URL_RE)) {
    const url = match[0];
    if (match.index + url.length >= text.length) {
      continue;
    }
    if (AUTH_HINT_RE.test(url)) {
      return url;
    }
  }
  return null;
};

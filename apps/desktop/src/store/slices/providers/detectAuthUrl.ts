const URL_RE = /https?:\/\/[^\s<>"'`|\\^{}\x00-\x1F\x7F]+/g;
const AUTH_PARAM_RE =
  /[?&](code|code_challenge|client_id|redirect_uri|response_type|state|challenge|user_code|device_code|token)=/i;
const AUTH_ROUTE_RE = /oauth|authoriz|cli[-_]?auth|device[-_]?code|user[-_]?code|\/callback/i;
const AUTH_WORD_RE = /log[-_]?in|sign[-_]?in|\/auth(\/|$|\?)|\bsso\b/i;

export type AuthUrlMatch = {
  readonly url: string;
  readonly score: number;
};

type Params = {
  readonly text: string;
};

type ScoreParams = {
  readonly url: string;
};

const scoreUrl = ({ url }: ScoreParams): number => {
  if (AUTH_PARAM_RE.test(url)) {
    return 3;
  }
  if (AUTH_ROUTE_RE.test(url)) {
    return 2;
  }
  if (AUTH_WORD_RE.test(url)) {
    return 1;
  }
  return 0;
};

export const detectAuthUrl = ({ text }: Params): AuthUrlMatch | null => {
  let best: AuthUrlMatch | null = null;
  for (const match of text.matchAll(URL_RE)) {
    const url = match[0];
    if (match.index + url.length >= text.length) {
      continue;
    }
    const score = scoreUrl({ url });
    if (score === 0) {
      continue;
    }
    if (best !== null && score <= best.score) {
      continue;
    }
    best = { url, score };
  }
  return best;
};

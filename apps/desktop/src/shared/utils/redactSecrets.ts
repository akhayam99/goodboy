const OPAQUE_SECRET_PATTERNS: ReadonlyArray<RegExp> = [
  /\bgh[pousr]_[A-Za-z0-9]{16,}/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,
  /\bxapp-[0-9]-[A-Za-z0-9-]{10,}/g,
  /\bsk-[A-Za-z0-9_-]{16,}/g,
  /\bglpat-[A-Za-z0-9_-]{16,}/g,
  /\blin_(?:api|oauth)_[A-Za-z0-9]{16,}/g,
  /\bsntrys_[A-Za-z0-9+/=_-]{16,}/g,
  /\bsntryu_[A-Za-z0-9]{16,}/g,
  /\bATATT[A-Za-z0-9_=+/-]{20,}/g,
  /\bATBB[A-Za-z0-9_=+/-]{16,}/g,
  /\bey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
];

const PRIVATE_KEY_PATTERN =
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[A-Za-z0-9+/=\s]*(?:-----END [A-Z0-9 ]*PRIVATE KEY-----)?/g;

const URL_USERINFO_PATTERN = /([A-Za-z][A-Za-z0-9+.-]{0,31}:\/\/)[^/@\s]+@/g;

const BEARER_PATTERN = /\b(bearer)(\s+)[^\s"',;&]+/gi;

const SECRET_LABEL = String.raw`((?:authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|auth[_-]?token|client[_-]?secret|password|passwd|secret)["']?)`;

const AUTH_SCHEME = String.raw`(?:bearer|basic|digest|token|jwt|apikey|negotiate|dpop)\s+`;

const SECRET_VALUE = String.raw`("[^"\n]*"|'[^'\n]*'|[^\s"',;&]+)`;

const LABELLED_SECRET_PATTERN = new RegExp(
  String.raw`${SECRET_LABEL}(?:(\s*[:=]\s*)|(\s+))(?:${AUTH_SCHEME})?${SECRET_VALUE}`,
  'gi',
);

const TOKEN_LABEL_PATTERN = new RegExp(
  String.raw`((?:token|bearer)["']?)(\s*[:=]\s*)(?:(?:bearer|basic|token)\s+)?${SECRET_VALUE}`,
  'gi',
);

const MIN_LOOSE_VALUE = 6;

const REDACTED = '[redacted]';

export const redactSecrets = ({ text }: { readonly text: string }): string => {
  const withoutUserinfo = text.replace(URL_USERINFO_PATTERN, `$1${REDACTED}@`);
  const withoutKeys = withoutUserinfo.replace(PRIVATE_KEY_PATTERN, REDACTED);
  const withoutOpaque = OPAQUE_SECRET_PATTERNS.reduce(
    (current, pattern) => current.replace(pattern, REDACTED),
    withoutKeys,
  );
  return withoutOpaque
    .replace(BEARER_PATTERN, `$1$2${REDACTED}`)
    .replace(
      LABELLED_SECRET_PATTERN,
      (
        match: string,
        label: string,
        strictSeparator: string | undefined,
        looseSeparator: string | undefined,
        value: string,
      ) => {
        if (strictSeparator !== undefined) {
          return `${label}${strictSeparator}${REDACTED}`;
        }
        if (value.length < MIN_LOOSE_VALUE) {
          return match;
        }
        return `${label}${looseSeparator ?? ''}${REDACTED}`;
      },
    )
    .replace(
      TOKEN_LABEL_PATTERN,
      (_match, label: string, separator: string) => `${label}${separator}${REDACTED}`,
    );
};

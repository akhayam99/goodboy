const OPAQUE_SECRET_PATTERNS: ReadonlyArray<RegExp> = [
  /\bgh[pousr]_[A-Za-z0-9]{16,}/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,
  /\bsk-[A-Za-z0-9_-]{16,}/g,
  /\bglpat-[A-Za-z0-9_-]{16,}/g,
  /\bey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
];

const SECRET_LABEL = String.raw`(authorization|bearer|api[_-]?key|access[_-]?token|refresh[_-]?token|password|passwd|secret)`;

const LABEL_SEPARATOR = String.raw`(\s*[:=]\s*|\s+)`;

const AUTH_SCHEME = String.raw`(?:bearer|basic|digest|token|jwt|apikey|negotiate|dpop)\s+`;

const SECRET_VALUE = String.raw`(?:"[^"\n]{6,}"|'[^'\n]{6,}'|[^\s"']{6,})`;

const LABELLED_SECRET_PATTERN = new RegExp(
  String.raw`\b${SECRET_LABEL}\b${LABEL_SEPARATOR}(?:${AUTH_SCHEME})?${SECRET_VALUE}`,
  'gi',
);

export const REDACTED = '[redacted]';

export const redactSecrets = ({ text }: { readonly text: string }): string => {
  const withoutOpaque = OPAQUE_SECRET_PATTERNS.reduce(
    (current, pattern) => current.replace(pattern, REDACTED),
    text,
  );
  return withoutOpaque.replace(
    LABELLED_SECRET_PATTERN,
    (_match, label: string, separator: string) => `${label}${separator}${REDACTED}`,
  );
};

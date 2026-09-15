const OPAQUE_SECRET_PATTERNS: ReadonlyArray<RegExp> = [
  /\bgh[pousr]_[A-Za-z0-9]{16,}/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,
  /\bsk-[A-Za-z0-9_-]{16,}/g,
  /\bglpat-[A-Za-z0-9_-]{16,}/g,
  /\bey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
];

const LABELLED_SECRET_PATTERN =
  /\b(authorization|bearer|api[_-]?key|access[_-]?token|refresh[_-]?token|password|passwd|secret)\b(\s*[:=]\s*|\s+)("?)[^\s"']{6,}\3/gi;

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

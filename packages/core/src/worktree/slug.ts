import { createHash } from 'node:crypto';

const MAX_SLUG_LENGTH = 40;

const trimHyphens = (s: string): string => {
  let start = 0;
  let end = s.length;
  while (start < end && s.charAt(start) === '-') start++;
  while (end > start && s.charAt(end - 1) === '-') end--;
  return s.slice(start, end);
};

export const sanitizeSlug = (input: string): string => {
  const collapsed = input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-');
  const cleaned = trimHyphens(trimHyphens(collapsed).slice(0, MAX_SLUG_LENGTH));

  if (cleaned.length === 0) {
    return createHash('sha256').update(input).digest('hex').slice(0, 8);
  }
  return cleaned;
};

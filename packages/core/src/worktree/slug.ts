import { createHash } from 'node:crypto';

const MAX_SLUG_LENGTH = 40;

export function sanitizeSlug(input: string): string {
  const cleaned = input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, '');

  if (cleaned.length === 0) {
    return createHash('sha256').update(input).digest('hex').slice(0, 8);
  }
  return cleaned;
}

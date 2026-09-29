import { sha256Hex } from './sha256';

export const MAX_SLUG_LENGTH = 48;

const HASH_FALLBACK_LENGTH = 8;

type SlugifyParams = {
  readonly input: string;
  readonly maxLength?: number;
  readonly fallback?: string;
};

export const slugify = ({
  input,
  maxLength = MAX_SLUG_LENGTH,
  fallback,
}: SlugifyParams): string => {
  const cleaned = input
    .replace(/[A-Z]/g, (letter) => letter.toLowerCase())
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/, '');
  if (cleaned !== '') {
    return cleaned;
  }
  return fallback ?? sha256Hex(input).slice(0, HASH_FALLBACK_LENGTH);
};

type SuffixParams = {
  readonly base: string;
  readonly suffix: string;
  readonly maxLength?: number;
};

export const trimSlugAtWord = ({
  value,
  maxLength,
}: {
  readonly value: string;
  readonly maxLength: number;
}): string => {
  if (value.length <= maxLength) {
    return value;
  }
  const sliced = value.slice(0, maxLength + 1);
  const boundary = sliced.lastIndexOf('-');
  if (boundary > 0) {
    return sliced.slice(0, boundary);
  }
  return value.slice(0, maxLength).replace(/-+$/g, '');
};

export const withSlugSuffix = ({
  base,
  suffix,
  maxLength = MAX_SLUG_LENGTH,
}: SuffixParams): string => {
  const maxBaseLength = maxLength - suffix.length - 1;
  return `${trimSlugAtWord({ value: base, maxLength: maxBaseLength })}-${suffix}`;
};

type NextSlugParams = {
  readonly base: string;
  readonly prefix: string;
  readonly taken: ReadonlyArray<string>;
  readonly randomSuffix?: () => string;
};

export const nextAvailableSlug = ({
  base,
  prefix,
  taken,
  randomSuffix = () => crypto.randomUUID().slice(0, 8),
}: NextSlugParams): string => {
  const used = new Set(taken);
  if (!used.has(`${prefix}/${base}`)) {
    return base;
  }
  for (let ordinal = 2; ordinal <= 99; ordinal += 1) {
    const candidate = withSlugSuffix({ base, suffix: String(ordinal) });
    if (!used.has(`${prefix}/${candidate}`)) {
      return candidate;
    }
  }
  return withSlugSuffix({ base, suffix: randomSuffix() });
};

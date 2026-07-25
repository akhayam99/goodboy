import { extractAuxOutput } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';

const WRAPPING_QUOTES = /^["'`“”‘’]+|["'`“”‘’]+$/g;
const TRAILING_PUNCTUATION = /[.,;:!?]+$/;
const MAX_TITLE_WORDS = 6;

type Params = {
  readonly providerId: ProviderId;
  readonly stdout: string;
};

export const parseGeneratedTitle = ({ providerId, stdout }: Params): string => {
  const text = extractAuxOutput({ providerId, stdout }).text;
  const firstLine = text.split(/\r?\n/).find((line) => line.trim().length > 0) ?? '';
  return firstLine
    .trim()
    .replace(WRAPPING_QUOTES, '')
    .replace(TRAILING_PUNCTUATION, '')
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .slice(0, MAX_TITLE_WORDS)
    .join(' ');
};

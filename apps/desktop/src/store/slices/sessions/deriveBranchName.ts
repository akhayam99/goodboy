import { MAX_SLUG_LENGTH, slugify, trimSlugAtWord, withSlugSuffix } from '@goodboy/core';
import { UNTITLED_BASE } from '../../../features/session/sessionTitle';

const DIR_SLUG_MAX_LENGTH = 40;
const DIR_SLUG_FALLBACK = 'session';
const IDENTIFIER_MAX_LENGTH = 16;

const slugifyDir = (input: string): string =>
  slugify({ input, maxLength: DIR_SLUG_MAX_LENGTH, fallback: DIR_SLUG_FALLBACK });

type Params = {
  readonly prefix: string;
  readonly sessionId: string;
  readonly goal: string;
  readonly explicitSlug?: string;
  readonly taskIdentifiers?: ReadonlyArray<string>;
  readonly existingBranches?: ReadonlyArray<string>;
};

const taskSlug = ({ identifier, goal }: { readonly identifier: string; readonly goal: string }) => {
  const normalizedIdentifier = trimSlugAtWord({
    value: slugifyDir(identifier).slice(0, IDENTIFIER_MAX_LENGTH).replace(/-+$/g, ''),
    maxLength: IDENTIFIER_MAX_LENGTH,
  });
  const bracketlessGoal = goal.replace(/\[[^\]]*\]/g, ' ');
  const escapedIdentifier = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const identifierlessGoal = bracketlessGoal.replace(new RegExp(escapedIdentifier, 'gi'), ' ');
  const remainder = slugifyDir(identifierlessGoal);
  return trimSlugAtWord({
    value: `${normalizedIdentifier}-${remainder}`,
    maxLength: MAX_SLUG_LENGTH,
  });
};

export const deriveBranchName = ({
  prefix,
  sessionId,
  goal,
  explicitSlug,
  taskIdentifiers = [],
  existingBranches = [],
}: Params): string => {
  if (explicitSlug !== undefined) {
    return explicitSlug;
  }
  const id8 = sessionId.slice(0, 8);
  const identifier = taskIdentifiers.find((candidate) => candidate.trim() !== '')?.trim();
  if (identifier !== undefined) {
    const candidate = taskSlug({ identifier, goal });
    const branch = `${prefix}/${candidate}`;
    if (!existingBranches.includes(branch)) {
      return candidate;
    }
    return withSlugSuffix({ base: candidate, suffix: id8 });
  }
  const trimmedGoal = goal.trim();
  if (trimmedGoal === '' || trimmedGoal === UNTITLED_BASE) {
    return `session-${id8}`;
  }
  return withSlugSuffix({ base: slugifyDir(trimmedGoal), suffix: id8 });
};

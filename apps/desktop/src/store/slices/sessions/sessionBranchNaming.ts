import { NO_TASK_BRANCH_TEMPLATE, slugify, trimSlugAtWord, type BranchValues } from '@goodboy/core';
import { UNTITLED_BASE } from '../../../features/session/sessionTitle';

const SLUG_MAX_LENGTH = 40;
const UNTITLED_SLUG = 'session';

export type BranchNaming = {
  readonly template: string;
  readonly values: BranchValues;
};

type Params = {
  readonly template: string;
  readonly prefix: string;
  readonly user: string | null;
  readonly goal: string;
  readonly explicitSlug?: string;
  readonly taskIdentifiers?: ReadonlyArray<string>;
};

const goalSlug = ({ text, fallback }: { readonly text: string; readonly fallback: string }) =>
  trimSlugAtWord({
    value: slugify({ input: text, maxLength: text.length, fallback }),
    maxLength: SLUG_MAX_LENGTH,
  });

const escapeForPattern = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const goalWithoutTask = ({
  goal,
  identifier,
}: {
  readonly goal: string;
  readonly identifier: string;
}): string =>
  goal.replace(/\[[^\]]*\]/g, ' ').replace(new RegExp(escapeForPattern(identifier), 'gi'), ' ');

export const sessionBranchNaming = ({
  template,
  prefix,
  user,
  goal,
  explicitSlug,
  taskIdentifiers = [],
}: Params): BranchNaming => {
  if (explicitSlug !== undefined) {
    return { template: NO_TASK_BRANCH_TEMPLATE, values: { prefix, slug: explicitSlug } };
  }
  const base: BranchValues = user === null ? { prefix } : { prefix, user };
  const identifier = taskIdentifiers.find((candidate) => candidate.trim() !== '')?.trim();
  if (identifier !== undefined) {
    return {
      template,
      values: {
        ...base,
        'task-id': identifier,
        slug: goalSlug({ text: goalWithoutTask({ goal, identifier }), fallback: '' }),
      },
    };
  }
  const trimmedGoal = goal.trim();
  if (trimmedGoal === '' || trimmedGoal === UNTITLED_BASE) {
    return { template, values: { ...base, slug: UNTITLED_SLUG } };
  }
  return {
    template,
    values: { ...base, slug: goalSlug({ text: trimmedGoal, fallback: UNTITLED_SLUG }) },
  };
};

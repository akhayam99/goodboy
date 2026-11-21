import { NAMES } from '../../../shared/utils/names';
import type { RetiredName } from '../RetiredName';

export const RETIRED: ReadonlyArray<RetiredName> = [
  {
    id: 'couldnt-read-load-title',
    pattern:
      /^Couldn't read (?:checks|ports|the scripts(?: of .*)?|the decisions.*|comments from .*)$/,
    use: NAMES.couldntLoad,
  },
  {
    id: 'did-not-load-title',
    pattern: /^(?:This session did not load|Detection failed|This run couldn't be read)$/,
    use: NAMES.couldntLoad,
  },
  { id: 'nothing-waits-for-you', pattern: /^Nothing waits for you$/, use: NAMES.noQuestionsYet },
  {
    id: 'pick-a-branch-from-the-trail',
    pattern: /\bPick a branch from the trail\b/,
    use: NAMES.addProject,
  },
  {
    id: 'add-a-branch',
    pattern: /^Add a branch to see its (?:commits|files)\.$/,
    use: NAMES.addProject,
  },
];

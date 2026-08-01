import type { NewSessionDraft } from './types';

export const EMPTY_NEW_SESSION_DRAFT: NewSessionDraft = {
  goal: '',
  branchSlug: '',
  slugTouched: false,
  branchMode: 'new',
  existingBranch: '',
  issue: null,
};

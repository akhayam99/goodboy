import type { NewSessionDraft } from './types';

export const EMPTY_NEW_SESSION_DRAFT: NewSessionDraft = {
  goal: '',
  branchSlug: '',
  slugTouched: false,
  folderName: '',
  folderNameTouched: false,
  branchMode: 'new',
  existingBranch: '',
  issues: [],
};

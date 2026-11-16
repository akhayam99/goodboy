import type { CSSProperties } from 'react';
import { tintClasses } from '@goodboy/ui';
import type { DiffHunkLine } from '@goodboy/types';

const ADD = tintClasses('success');
const DEL = tintClasses('danger');

export const LINE_FILL: Record<DiffHunkLine['kind'], string> = {
  add: 'bg-diff-add-line',
  del: 'bg-diff-remove-line',
  context: '',
};

export const WORD_FILL: Record<DiffHunkLine['kind'], string> = {
  add: 'bg-diff-add-word rounded-sm',
  del: 'bg-diff-remove-word rounded-sm',
  context: '',
};

export const SIGN_TEXT: Record<DiffHunkLine['kind'], string> = {
  add: ADD.text,
  del: DEL.text,
  context: 'text-transparent',
};

export const SELECTED_FILL = 'bg-primary-subtle';

export const SELECTED_RAIL = 'shadow-[inset_2px_0_0_var(--color-primary-solid)]';

export const EMPTY_SIDE_FILL = 'bg-subtle';

export const HANGING_INDENT: CSSProperties = { paddingInlineStart: '2ch', textIndent: '-2ch' };

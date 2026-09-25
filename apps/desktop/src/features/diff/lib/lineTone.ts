import { cn, tintClasses } from '@goodboy/ui';
import type { DiffHunkLine } from '@goodboy/types';

const ADD = tintClasses('success');
const DEL = tintClasses('danger');
const SELECT = tintClasses('primary');

export const LINE_FILL: Record<DiffHunkLine['kind'], string> = {
  add: ADD.bg,
  del: DEL.bg,
  context: '',
};

export const WORD_FILL: Record<DiffHunkLine['kind'], string> = {
  add: cn(ADD.bg, 'rounded-sm'),
  del: cn(DEL.bg, 'rounded-sm'),
  context: '',
};

export const SIGN_TEXT: Record<DiffHunkLine['kind'], string> = {
  add: ADD.text,
  del: DEL.text,
  context: 'text-transparent',
};

export const SELECTED_FILL = cn(SELECT.bg);

export const SELECTED_RAIL = 'shadow-[inset_2px_0_0_var(--color-primary)]';

export const EMPTY_SIDE_FILL = 'bg-subtle';

import type { ComponentType } from 'react';
import { NextListScene } from './nextList/NextListScene';

export const U27_NEXT_LIST_SCENES: Readonly<Record<string, ComponentType>> = {
  'u27-next-list-before-light': () => <NextListScene theme="light" moment="before" />,
  'u27-next-list-before-dark': () => <NextListScene theme="dark" moment="before" />,
  'u27-next-list-after-light': () => <NextListScene theme="light" moment="after-decide" />,
  'u27-next-list-after-dark': () => <NextListScene theme="dark" moment="after-decide" />,
  'u27-next-list-after-fix-light': () => <NextListScene theme="light" moment="after-fix" />,
  'u27-next-list-after-fix-dark': () => <NextListScene theme="dark" moment="after-fix" />,
};

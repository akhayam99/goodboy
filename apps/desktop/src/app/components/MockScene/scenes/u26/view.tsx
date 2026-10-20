import type { ComponentType } from 'react';
import { CentralColumnScene } from './CentralColumnScene';

export const U26_VIEW_SCENES: Readonly<Record<string, ComponentType>> = {
  'u26-view-classic-light': () => <CentralColumnScene theme="light" kind="mid" layout="classic" />,
  'u26-view-classic-dark': () => <CentralColumnScene theme="dark" kind="mid" layout="classic" />,
  'u26-view-archived-light': () => <CentralColumnScene theme="light" kind="mid" isArchived />,
  'u26-view-archived-dark': () => <CentralColumnScene theme="dark" kind="mid" isArchived />,
  'u26-view-new-light': () => <CentralColumnScene theme="light" kind="mid" />,
  'u26-view-new-dark': () => <CentralColumnScene theme="dark" kind="mid" />,
};

import type { ComponentType } from 'react';
import { CentralColumnScene } from '../u26/CentralColumnScene';

export const U36_OVERVIEW_SCENES: Readonly<Record<string, ComponentType>> = {
  'u36-p15-next-only-light': () => <CentralColumnScene theme="light" kind="finished" />,
  'u36-p15-next-only-dark': () => <CentralColumnScene theme="dark" kind="finished" />,
  'u36-p15-needs-you-light': () => <CentralColumnScene theme="light" kind="mid" />,
  'u36-p15-needs-you-dark': () => <CentralColumnScene theme="dark" kind="mid" />,
};

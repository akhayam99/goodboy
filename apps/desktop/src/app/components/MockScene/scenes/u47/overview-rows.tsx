import type { ComponentType } from 'react';
import { CentralColumnScene } from '../u26/CentralColumnScene';

export const U47_OVERVIEW_ROWS_SCENES = {
  'u47-overview-rows-two-projects': () => <CentralColumnScene kind="branches" />,
  'u47-overview-rows-two-projects-light': () => (
    <CentralColumnScene kind="branches" theme="light" />
  ),
} satisfies Readonly<Record<string, ComponentType>>;

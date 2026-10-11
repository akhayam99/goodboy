import { createElement, type ComponentType } from 'react';
import { SidebarNavColumnScene } from '../u23/SidebarNavColumnScene';

const REST = { pinCount: 3 } as const;
const DRAFT = { pinCount: 3, hasDraft: true } as const;

export const U24_DOORS_SCENES: Readonly<Record<string, ComponentType>> = {
  'column-create-row': () => createElement(SidebarNavColumnScene, { config: REST }),
  'column-create-draft': () => createElement(SidebarNavColumnScene, { config: DRAFT }),
  'column-create-draftopen': () =>
    createElement(SidebarNavColumnScene, { config: DRAFT, place: 'new' }),
};

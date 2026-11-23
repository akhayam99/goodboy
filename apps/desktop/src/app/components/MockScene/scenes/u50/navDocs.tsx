import type { ComponentType } from 'react';
import { NavDocsScene } from './NavDocsScene';

export const U50_NAV_DOCS_SCENES: Readonly<Record<string, ComponentType>> = {
  'u50-nav-docs-light': () => <NavDocsScene theme="light" />,
  'u50-nav-docs-dark': () => <NavDocsScene theme="dark" />,
};

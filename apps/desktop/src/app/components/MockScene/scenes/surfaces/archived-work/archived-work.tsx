import type { ComponentType } from 'react';
import { ArchivedWorkScene } from './ArchivedWorkScene';

export const ARCHIVED_WORK_SCENES = {
  'archived-work-pr-light': () => <ArchivedWorkScene theme="light" variant="archived" />,
  'archived-work-pr-dark': () => <ArchivedWorkScene theme="dark" variant="archived" />,
  'archived-work-merged-light': () => <ArchivedWorkScene theme="light" variant="merged" />,
  'archived-work-merged-dark': () => <ArchivedWorkScene theme="dark" variant="merged" />,
} satisfies Readonly<Record<string, ComponentType>>;

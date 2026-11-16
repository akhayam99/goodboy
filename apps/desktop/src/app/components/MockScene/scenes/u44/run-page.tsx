import type { ComponentType } from 'react';
import { U44RunPageScene } from './U44RunPageScene';

export const U44_RUN_PAGE_SCENES = {
  'u44-run-page': () => <U44RunPageScene theme="dark" isAsking={false} />,
  'u44-run-page-light': () => <U44RunPageScene theme="light" isAsking={false} />,
  'u44-run-page-ask': () => <U44RunPageScene theme="dark" isAsking />,
  'u44-run-page-ask-light': () => <U44RunPageScene theme="light" isAsking />,
} satisfies Readonly<Record<string, ComponentType>>;

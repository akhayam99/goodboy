import { Suspense, lazy } from 'react';
import { shouldOpenDemoPhone } from './demo/phone/shouldOpenDemoPhone';

const MockScene = lazy(() => import('./index').then((module) => ({ default: module.MockScene })));

const DemoPhone = lazy(() =>
  import('./demo/phone/DemoPhone').then((module) => ({ default: module.DemoPhone })),
);

const isDemoPhone = shouldOpenDemoPhone({
  search: window.location.search,
  mode: import.meta.env.MODE,
});

export const MockEntry = () => (
  <Suspense fallback={null}>{isDemoPhone ? <DemoPhone /> : <MockScene />}</Suspense>
);

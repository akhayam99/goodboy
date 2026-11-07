import { useEffect, type ComponentType } from 'react';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { CentralColumnScene } from '../u26/CentralColumnScene';
import { C07AutoFrame } from '../u25/c07/C07AutoFrame';
import type { C07Seed } from '../u25/c07/c07AutoSeed';

type AutoProps = {
  readonly theme: 'dark' | 'light';
  readonly seed: C07Seed;
};

const RUNNING: C07Seed = { state: 'working', place: 'auto' };
const FAILED: C07Seed = { state: 'blocked', place: 'auto' };
const PAUSED: C07Seed = { state: 'working', place: 'auto', isCapped: true };

const AutoStateScene = ({ theme, seed }: AutoProps) => {
  useEffect(() => {
    applyDocumentTheme({ theme });
  }, [theme]);
  return <C07AutoFrame seed={seed} />;
};

export const U36_STATES_SCENES: Readonly<Record<string, ComponentType>> = {
  'u36-states-overview-needs-you-light': () => <CentralColumnScene theme="light" kind="stuck" />,
  'u36-states-overview-needs-you-dark': () => <CentralColumnScene theme="dark" kind="stuck" />,
  'u36-states-overview-failed-light': () => <CentralColumnScene theme="light" kind="failed" />,
  'u36-states-overview-failed-dark': () => <CentralColumnScene theme="dark" kind="failed" />,
  'u36-states-overview-blocked-child-light': () => (
    <CentralColumnScene theme="light" kind="blocked" />
  ),
  'u36-states-overview-blocked-child-dark': () => (
    <CentralColumnScene theme="dark" kind="blocked" />
  ),
  'u36-states-auto-running-light': () => <AutoStateScene theme="light" seed={RUNNING} />,
  'u36-states-auto-running-dark': () => <AutoStateScene theme="dark" seed={RUNNING} />,
  'u36-states-auto-failed-light': () => <AutoStateScene theme="light" seed={FAILED} />,
  'u36-states-auto-failed-dark': () => <AutoStateScene theme="dark" seed={FAILED} />,
  'u36-states-auto-paused-light': () => <AutoStateScene theme="light" seed={PAUSED} />,
  'u36-states-auto-paused-dark': () => <AutoStateScene theme="dark" seed={PAUSED} />,
};

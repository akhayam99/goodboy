import type { ComponentType } from 'react';
import { CentralNowScene } from './CentralNowScene';

export const U26_CENTRAL_NOW_SCENES: Readonly<Record<string, ComponentType>> = {
  'u26-central-now-run-light': () => <CentralNowScene theme="light" variant="run" />,
  'u26-central-now-run-dark': () => <CentralNowScene theme="dark" variant="run" />,
  'u26-central-now-orchestrated-light': () => (
    <CentralNowScene theme="light" variant="orchestrated" />
  ),
  'u26-central-now-orchestrated-dark': () => (
    <CentralNowScene theme="dark" variant="orchestrated" />
  ),
  'u26-central-now-auto-light': () => <CentralNowScene theme="light" variant="auto" />,
  'u26-central-now-auto-dark': () => <CentralNowScene theme="dark" variant="auto" />,
  'u26-central-now-agent-light': () => <CentralNowScene theme="light" variant="agent" />,
  'u26-central-now-agent-dark': () => <CentralNowScene theme="dark" variant="agent" />,
  'u26-central-now-branches-light': () => <CentralNowScene theme="light" variant="branches" />,
  'u26-central-now-branches-dark': () => <CentralNowScene theme="dark" variant="branches" />,
  'u26-central-now-story-light': () => <CentralNowScene theme="light" variant="story" />,
  'u26-central-now-story-dark': () => <CentralNowScene theme="dark" variant="story" />,
  'u26-central-now-story-many-light': () => <CentralNowScene theme="light" variant="story-many" />,
  'u26-central-now-story-many-dark': () => <CentralNowScene theme="dark" variant="story-many" />,
  'u26-central-now-story-skipped-light': () => (
    <CentralNowScene theme="light" variant="story-skipped" />
  ),
  'u26-central-now-story-skipped-dark': () => (
    <CentralNowScene theme="dark" variant="story-skipped" />
  ),
  'u26-central-now-finished-light': () => <CentralNowScene theme="light" variant="finished" />,
  'u26-central-now-finished-dark': () => <CentralNowScene theme="dark" variant="finished" />,
  'u26-central-now-stale-light': () => <CentralNowScene theme="light" variant="stale" />,
};

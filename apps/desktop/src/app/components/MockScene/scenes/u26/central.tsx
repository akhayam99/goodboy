import type { ComponentType } from 'react';
import { CentralColumnScene } from './CentralColumnScene';

export const U26_CENTRAL_SCENES: Readonly<Record<string, ComponentType>> = {
  'u26-central-mid-light': () => <CentralColumnScene theme="light" kind="mid" />,
  'u26-central-mid-dark': () => <CentralColumnScene theme="dark" kind="mid" />,
  'u26-central-finished-light': () => <CentralColumnScene theme="light" kind="finished" />,
  'u26-central-finished-dark': () => <CentralColumnScene theme="dark" kind="finished" />,
  'u26-central-stuck-light': () => <CentralColumnScene theme="light" kind="stuck" />,
  'u26-central-stuck-dark': () => <CentralColumnScene theme="dark" kind="stuck" />,
  'u26-central-blocked-light': () => <CentralColumnScene theme="light" kind="blocked" />,
  'u26-central-blocked-dark': () => <CentralColumnScene theme="dark" kind="blocked" />,
  'u26-central-orchestrated-light': () => <CentralColumnScene theme="light" kind="orchestrated" />,
  'u26-central-orchestrated-dark': () => <CentralColumnScene theme="dark" kind="orchestrated" />,
  'u26-central-agent-light': () => <CentralColumnScene theme="light" kind="agent" />,
  'u26-central-agent-dark': () => <CentralColumnScene theme="dark" kind="agent" />,
  'u26-central-branches-light': () => <CentralColumnScene theme="light" kind="branches" />,
  'u26-central-branches-dark': () => <CentralColumnScene theme="dark" kind="branches" />,
  'u26-central-log-light': () => <CentralColumnScene theme="light" kind="mid" isLogOpen />,
  'u26-central-log-dark': () => <CentralColumnScene theme="dark" kind="mid" isLogOpen />,
};

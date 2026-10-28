import type { ComponentType } from 'react';
import { RunningListScene } from './runningList/RunningListScene';

export const U28_RUNNING_LIST_SCENES: Readonly<Record<string, ComponentType>> = {
  'u28-running-list-light': () => <RunningListScene theme="light" />,
  'u28-running-list-dark': () => <RunningListScene theme="dark" />,
};

import type { ComponentType } from 'react';
import { MergeTrainScene } from './MergeTrainScene';

export const U50_MERGE_TRAIN_SCENES: Readonly<Record<string, ComponentType>> = {
  'u50-merge-train-ready-light': () => <MergeTrainScene theme="light" isRunning={false} />,
  'u50-merge-train-ready-dark': () => <MergeTrainScene theme="dark" isRunning={false} />,
  'u50-merge-train-running-light': () => <MergeTrainScene theme="light" isRunning />,
  'u50-merge-train-running-dark': () => <MergeTrainScene theme="dark" isRunning />,
};

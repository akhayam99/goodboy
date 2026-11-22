import type { ComponentType } from 'react';
import { QueueScene } from './QueueScene';

export const U50_QUEUE_SCENES: Readonly<Record<string, ComponentType>> = {
  'u50-queue-light': () => <QueueScene theme="light" isClear={false} />,
  'u50-queue-dark': () => <QueueScene theme="dark" isClear={false} />,
  'u50-queue-clear-light': () => <QueueScene theme="light" isClear />,
  'u50-queue-clear-dark': () => <QueueScene theme="dark" isClear />,
};

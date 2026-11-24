import type { ComponentType } from 'react';
import { TasksFailureScene } from './TasksFailureScene';

export const TASKS_SOURCE_FAILURE_SCENES: Readonly<Record<string, ComponentType>> = {
  'tasks-source-failure': () => <TasksFailureScene theme="light" />,
  'tasks-source-failure-dark': () => <TasksFailureScene theme="dark" />,
};

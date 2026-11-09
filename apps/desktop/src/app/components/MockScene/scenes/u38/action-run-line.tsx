import { ActionRunLineScene } from './ActionRunLineScene';

export const U38_ACTION_RUN_LINE_SCENES = {
  'u38-action-run-slow': () => <ActionRunLineScene variant="slow" theme="dark" />,
  'u38-action-run-slow-light': () => <ActionRunLineScene variant="slow" theme="light" />,
  'u38-action-run-done': () => <ActionRunLineScene variant="done" theme="dark" />,
  'u38-action-run-done-light': () => <ActionRunLineScene variant="done" theme="light" />,
  'u38-action-run-failed': () => <ActionRunLineScene variant="failed" theme="dark" />,
  'u38-action-run-failed-light': () => <ActionRunLineScene variant="failed" theme="light" />,
};

import { ActionRunLineScene } from './ActionRunLineScene';

export const ACTION_RUN_LINE_SCENES = {
  'action-run-idle': () => <ActionRunLineScene variant="idle" theme="dark" />,
  'action-run-idle-light': () => <ActionRunLineScene variant="idle" theme="light" />,
  'action-run-busy': () => <ActionRunLineScene variant="busy" theme="dark" />,
  'action-run-busy-light': () => <ActionRunLineScene variant="busy" theme="light" />,
  'action-run-done': () => <ActionRunLineScene variant="done" theme="dark" />,
  'action-run-done-light': () => <ActionRunLineScene variant="done" theme="light" />,
  'action-run-failed': () => <ActionRunLineScene variant="failed" theme="dark" />,
  'action-run-failed-light': () => <ActionRunLineScene variant="failed" theme="light" />,
};

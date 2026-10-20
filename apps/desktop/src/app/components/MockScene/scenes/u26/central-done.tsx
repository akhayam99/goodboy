import type { ComponentType } from 'react';
import { CentralDoneScene } from './CentralDoneScene';

export const U26_CENTRAL_DONE_SCENES: Readonly<Record<string, ComponentType>> = {
  'u26-central-done-mid-light': () => <CentralDoneScene theme="light" moment="mid" />,
  'u26-central-done-mid-dark': () => <CentralDoneScene theme="dark" moment="mid" />,
  'u26-central-done-open-light': () => <CentralDoneScene theme="light" moment="open" />,
  'u26-central-done-open-dark': () => <CentralDoneScene theme="dark" moment="open" />,
  'u26-central-done-batch-light': () => <CentralDoneScene theme="light" moment="batch" />,
  'u26-central-done-batch-dark': () => <CentralDoneScene theme="dark" moment="batch" />,
  'u26-central-done-recap-light': () => <CentralDoneScene theme="light" moment="recap" />,
  'u26-central-done-recap-dark': () => <CentralDoneScene theme="dark" moment="recap" />,
  'u26-central-log-search-light': () => (
    <CentralDoneScene theme="light" moment="log" search="rebase" />
  ),
};

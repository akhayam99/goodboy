import { TaskPickerScene } from './taskPicker/TaskPickerScene';

export const U44_TASK_PICKER_SCENES = {
  'u44-task-picker-all': () => <TaskPickerScene state="all" />,
  'u44-task-picker-sentry': () => <TaskPickerScene state="sentry" />,
  'u44-task-picker-error': () => <TaskPickerScene state="error" />,
  'u44-task-picker-loading': () => <TaskPickerScene state="loading" />,
};

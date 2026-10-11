import { PickerStarredScene } from './settings-projects/PickerStarredScene';
import { SettingsProjectsScene } from './settings-projects/SettingsProjectsScene';

export const U24_SETTINGS_PROJECTS_SCENES = {
  'settings-projects-rows': () => <SettingsProjectsScene variant="rows" />,
  'settings-projects-open': () => <SettingsProjectsScene variant="open" />,
  'settings-projects-failed': () => <SettingsProjectsScene variant="failed" />,
  'settings-projects-nostar': () => <SettingsProjectsScene variant="nostar" />,
  'picker-starred': PickerStarredScene,
};

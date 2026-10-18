import type { AppSection } from './components/SettingsStudio/appSections';
import type { StudioPlace } from '../../store/slices/navigation/studio';

const IPHONE_SECTION: AppSection = 'iphone';

export const IPHONE_SETTINGS_PLACE = {
  kind: 'settings',
  focus: { scope: 'app', section: IPHONE_SECTION },
} as const satisfies StudioPlace;

import { invokeCommand } from './invokeCommand';

export const openPrivacySettings = async (): Promise<void> => {
  await invokeCommand('open_privacy_settings', {});
};

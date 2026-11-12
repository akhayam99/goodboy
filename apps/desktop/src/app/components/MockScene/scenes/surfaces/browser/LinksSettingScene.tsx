import { useCallback } from 'react';
import { applyDocumentTheme } from '../../../../../../shared/lib/theme';
import { SETTING_LINKS_OPEN } from '../../../../../../shared/lib/linksOpenSetting';
import { useAppStore } from '../../../../../../store';
import { SettingsFrame } from '../../audit/SettingsFrame';

type Props = {
  readonly theme: 'light' | 'dark';
};

export const LinksSettingScene = ({ theme }: Props) => {
  const seed = useCallback(() => {
    applyDocumentTheme({ theme });
    useAppStore.setState({ settings: { [SETTING_LINKS_OPEN]: 'goodboy' } });
  }, [theme]);
  return <SettingsFrame focus={{ scope: 'app' }} seed={seed} />;
};

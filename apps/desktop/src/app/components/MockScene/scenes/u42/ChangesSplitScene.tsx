import { useEffect } from 'react';
import { setupOfferKey } from '../../../../../features/worktree/newWorktreeSettings';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { useAppStore } from '../../../../../store';
import { CTX_PAYMENTS_MOUNT_ID } from '../brand/contextBase';
import { BrandDiffScene } from '../brand/DiffScene';

const SETUP_OFFER = JSON.stringify({
  command: 'pnpm install',
  carried: 2,
  skipped: 0,
  state: 'offered',
});

type Props = {
  readonly patch: string;
  readonly theme: 'light' | 'dark';
  readonly hasSetupOffer?: boolean;
};

export const ChangesSplitScene = ({ patch, theme, hasSetupOffer = false }: Props) => {
  useEffect(() => {
    applyDocumentTheme({ theme });
  }, [theme]);
  useEffect(() => {
    if (!hasSetupOffer) {
      return;
    }
    useAppStore.setState((state) => ({
      settings: {
        ...state.settings,
        [setupOfferKey({ mountId: CTX_PAYMENTS_MOUNT_ID })]: SETUP_OFFER,
      },
      loadSetting: async () => null,
    }));
  }, [hasSetupOffer]);
  return <BrandDiffScene patch={patch} />;
};

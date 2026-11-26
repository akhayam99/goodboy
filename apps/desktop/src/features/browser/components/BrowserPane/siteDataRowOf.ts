import type { MenuConfirm } from '@goodboy/ui';

type Params = {
  readonly host: string | null;
  readonly isWholeStore: boolean;
};

type SiteDataRow = {
  readonly label: string;
  readonly confirm: MenuConfirm;
};

const SITE_LABEL = 'Clear site data';
const STORE_LABEL = 'Clear browser data';

export const siteDataRowOf = ({ host, isWholeStore }: Params): SiteDataRow => {
  if (isWholeStore) {
    return {
      label: STORE_LABEL,
      confirm: {
        role: 'danger',
        title: 'Clear browser data for this workspace?',
        description:
          'Every site open here loses its cookies, storage and cache, and signs you out. The page reloads after.',
        confirmLabel: STORE_LABEL,
      },
    };
  }
  return {
    label: SITE_LABEL,
    confirm: {
      role: 'danger',
      title: `Clear data for ${host ?? 'this site'}?`,
      description:
        'Its cookies, storage, cache and service workers go, and it signs you out. Other sites keep theirs. The page reloads after.',
      confirmLabel: SITE_LABEL,
    },
  };
};

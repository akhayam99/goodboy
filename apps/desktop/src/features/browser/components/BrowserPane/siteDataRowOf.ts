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
        description: 'Signs you out of every site in this workspace.',
        confirmLabel: STORE_LABEL,
      },
    };
  }
  return {
    label: SITE_LABEL,
    confirm: {
      role: 'danger',
      title: `Clear data for ${host ?? 'this site'}?`,
      description: 'Signs you out of this site. Other sites keep their data.',
      confirmLabel: SITE_LABEL,
    },
  };
};

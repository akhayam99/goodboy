import type { PermissionMark } from '../../../auto/tree/markersOf';

type Params = {
  readonly mark: PermissionMark;
};

export const permissionMarkLabelOf = ({ mark }: Params): string =>
  `${mark.decision === 'allow' ? 'Allowed' : 'Denied'} ${mark.tools.join(', ')}`;

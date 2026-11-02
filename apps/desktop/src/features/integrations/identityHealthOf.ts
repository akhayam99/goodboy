import { viewerNameOf, type ViewerBinding } from '../../store/slices/thread-reads/viewerNameOf';

export type IdentityHealth = {
  readonly isMissing: boolean;
  readonly copy: string;
  readonly action: string;
};

type Params = {
  readonly binding: ViewerBinding | null;
};

const MISSING_COPY = 'Unread needs your username.';
const RECONNECT_ACTION = 'Reconnect';

export const identityHealthOf = ({ binding }: Params): IdentityHealth => ({
  isMissing: binding !== null && viewerNameOf({ binding }) === '',
  copy: MISSING_COPY,
  action: RECONNECT_ACTION,
});

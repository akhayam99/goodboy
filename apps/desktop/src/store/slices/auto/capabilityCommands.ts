import type { AutoTreeId } from '@goodboy/types';
import { invokeCommand } from '../../../shared/lib/invokeCommand';

type RevokeTreeParams = {
  readonly treeId: AutoTreeId;
};

export const revokeTreeCapabilities = ({ treeId }: RevokeTreeParams): Promise<number> =>
  invokeCommand<number>('auto_capability_revoke_tree', { treeId });

type RevokeOlderParams = {
  readonly treeId: AutoTreeId;
  readonly generation: number;
};

export const revokeOlderCapabilities = ({
  treeId,
  generation,
}: RevokeOlderParams): Promise<number> =>
  invokeCommand<number>('auto_capability_revoke_generation', { treeId, generation });

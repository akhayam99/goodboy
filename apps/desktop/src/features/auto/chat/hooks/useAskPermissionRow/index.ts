import { useEffect, useState } from 'react';
import type { LeadPermissionKey } from '@goodboy/core/auto';
import type { AutoTreeId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { useIsWorkOn } from '../../../../../shared/hooks/useIsWorkOn';
import { PERMISSION_ROWS } from '../../../permissions/permissionRows';

type Params = {
  readonly treeId: AutoTreeId;
  readonly rowKey: LeadPermissionKey;
};

const UNREAD = "Couldn't read the permission";

export const useAskPermissionRow = ({ treeId, rowKey }: Params): string | null => {
  const isWorkFlowOn = useIsWorkOn();
  const readPermissions = useAppStore((state) => state.readLeadPermissions);
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    const read = async (): Promise<void> => {
      try {
        const permissions = await readPermissions({ target: { treeId }, isWorkFlowOn });
        const copy = PERMISSION_ROWS.find((row) => row.key === rowKey);
        const row = permissions.rows[rowKey];
        const value = copy?.options.find((option) => option.value === row.value)?.label;
        if (!isCurrent || copy === undefined || value === undefined) {
          return;
        }
        const source = row.source === 'lead' ? 'This Lead' : 'Workspace default';
        setText(`${copy.title}: ${value} · ${source}`);
      } catch {
        if (isCurrent) {
          setText(UNREAD);
        }
      }
    };
    setText(null);
    void read();
    return () => {
      isCurrent = false;
    };
  }, [readPermissions, isWorkFlowOn, treeId, rowKey]);

  return text;
};

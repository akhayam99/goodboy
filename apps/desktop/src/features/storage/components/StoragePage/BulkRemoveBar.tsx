import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { SelectionBar, SelectionConfirm } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import type { StorageFolder } from '../../../../store/slices/storage/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { formatBytes } from '../../../../shared/utils/formatBytes';
import { pluralize } from '../../../../shared/utils/pluralize';
import { storageScopeLabel } from '../../storageScopeLabel';

type Props = {
  readonly workspaceName: string | null;
  readonly selected: ReadonlySet<string>;
  readonly total: number;
  readonly isConfirming: boolean;
  readonly onArm: () => void;
  readonly onCancel: () => void;
  readonly onClear: () => void;
  readonly onSelectAll: () => void;
  readonly onDone: () => void;
};

type TallyParams = {
  readonly folders: ReadonlyArray<StorageFolder>;
};

const bytesOf = ({ folders }: TallyParams): number =>
  folders.reduce((sum, folder) => sum + (folder.sizeBytes ?? 0), 0);

export const BulkRemoveBar = ({
  workspaceName,
  selected,
  total,
  isConfirming,
  onArm,
  onCancel,
  onClear,
  onSelectAll,
  onDone,
}: Props) => {
  const scope = storageScopeLabel({ workspaceName });
  const folders = useAppStore((state) => state.storageFolders);
  const removeStorageFolders = useAppStore((state) => state.removeStorageFolders);
  const reportError = useAppStore((state) => state.reportError);
  const [isBusy, setIsBusy] = useState(false);

  if (selected.size === 0) {
    return null;
  }

  const chosen = folders.filter((folder) => selected.has(folder.path));
  const withCommits = chosen.filter((folder) => (folder.facts?.localOnlyCommits ?? 0) > 0).length;
  const commitsClause =
    withCommits === 0 ? '' : `, including ${withCommits} with commits that were never pushed`;
  const sizeLabel = formatBytes({ bytes: bytesOf({ folders: chosen }) });

  const onConfirm = async () => {
    setIsBusy(true);
    try {
      await removeStorageFolders({ paths: chosen.map((folder) => folder.path), mode: 'safe' });
      onDone();
    } catch (error) {
      void reportError({ title: "Couldn't remove the folders", error });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <SelectionBar
      placement="sticky"
      count={selected.size}
      total={total}
      verbs={[
        {
          id: 'remove',
          label: 'Remove',
          ariaLabel: 'Remove selected folders',
          tone: 'danger',
          icon: <Trash2 size={ICON_SIZE.row} aria-hidden />,
          isDisabled: isBusy,
          onRun: onArm,
        },
      ]}
      onClear={onClear}
      onSelectAll={onSelectAll}
      clearShortcut="selection.clear"
      selectAllShortcut="selection.all"
      onDismissConfirm={onCancel}
      confirm={
        isConfirming ? (
          <SelectionConfirm
            role="danger"
            icon={<Trash2 size={ICON_SIZE.row} aria-hidden />}
            title={`Remove ${pluralize(chosen.length, 'folder')} ${scope} (${sizeLabel})?`}
            description={`Branches stay${commitsClause}. Folders with changes are skipped.`}
            confirmLabel="Remove"
            isConfirmDisabled={chosen.length === 0}
            isBusy={isBusy}
            onConfirm={onConfirm}
            onCancel={onCancel}
          />
        ) : null
      }
    />
  );
};

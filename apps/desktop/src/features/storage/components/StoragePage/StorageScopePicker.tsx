import { useMemo } from 'react';
import type { Workspace, WorkspaceId } from '@goodboy/types';
import { Listbox, type ListboxOption } from '@goodboy/ui';
import { useAppStore, useCurrentWorkspace, useWorkspaces } from '../../../../store';
import { formatBytes } from '../../../../shared/utils/formatBytes';
import type { StorageScope } from '../../../../store/slices/storage/types';
import { storageWeightByScope } from '../../storageWeightByScope';

type Props = {
  readonly scope: StorageScope;
  readonly hasRemoved?: boolean;
  readonly onChange: (scope: StorageScope) => void;
};

const ALL_VALUE = 'all';
const REMOVED_VALUE = 'removed';
const workspaceValue = (id: WorkspaceId): string => `workspace:${id}`;

const scopeToValue = (scope: StorageScope): string => {
  if (scope.kind === 'workspace') {
    return workspaceValue(scope.id);
  }
  return scope.kind;
};

const valueToScope = (value: string): StorageScope => {
  if (value === ALL_VALUE) {
    return { kind: 'all' };
  }
  if (value === REMOVED_VALUE) {
    return { kind: 'removed' };
  }
  return { kind: 'workspace', id: value.slice('workspace:'.length) as WorkspaceId };
};

export const StorageScopePicker = ({ scope, hasRemoved = true, onChange }: Props) => {
  const workspaces = useWorkspaces();
  const currentWorkspace = useCurrentWorkspace();
  const folders = useAppStore((state) => state.storageFolders);
  const roots = useAppStore((state) => state.storageRoots);

  const weights = useMemo(() => storageWeightByScope({ folders, roots }), [folders, roots]);
  const allBytes =
    [...weights.byWorkspace.values()].reduce((sum, bytes) => sum + bytes, 0) + weights.removedBytes;

  const otherWorkspaces = workspaces.filter((workspace) => workspace.id !== currentWorkspace?.id);

  const options: ReadonlyArray<ListboxOption<string>> = [
    ...(currentWorkspace === null
      ? []
      : [
          {
            value: workspaceValue(currentWorkspace.id),
            label: currentWorkspace.name,
            description: 'This window',
          },
        ]),
    ...otherWorkspaces.map((workspace: Workspace) => ({
      value: workspaceValue(workspace.id),
      label: workspace.name,
      meta: hasRemoved
        ? formatBytes({ bytes: weights.byWorkspace.get(workspace.id) ?? 0 })
        : undefined,
    })),
    ...(hasRemoved
      ? [
          {
            value: REMOVED_VALUE,
            label: 'Removed workspaces',
            meta: formatBytes({ bytes: weights.removedBytes }),
          },
        ]
      : []),
    {
      value: ALL_VALUE,
      label: 'All workspaces',
      meta: hasRemoved ? formatBytes({ bytes: allBytes }) : undefined,
    },
  ];

  return (
    <Listbox
      ariaLabel="Storage scope"
      trigger="quiet"
      size="sm"
      value={scopeToValue(scope)}
      options={options}
      onChange={(value) => onChange(valueToScope(value))}
    />
  );
};

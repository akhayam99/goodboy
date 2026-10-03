import { useCallback, useEffect, useRef, useState } from 'react';
import type { ArtifactListRow } from '../../../artifactListRows';
import type { ArtifactGroup } from '../../../artifactStateOf';

type Params = {
  readonly rows: ReadonlyArray<ArtifactListRow>;
};

const CLOSED_AT_REST: ReadonlySet<ArtifactGroup> = new Set<ArtifactGroup>(['ran', 'deleted']);

const toggled = <T>({ set, value }: { readonly set: ReadonlySet<T>; readonly value: T }) => {
  const next = new Set(set);
  if (next.has(value)) {
    next.delete(value);
    return next;
  }
  next.add(value);
  return next;
};

export const useArtifactGroups = ({ rows }: Params) => {
  const [closedGroups, setClosedGroups] = useState<ReadonlySet<ArtifactGroup>>(CLOSED_AT_REST);
  const [openPartsIds, setOpenPartsIds] = useState<ReadonlySet<string>>(new Set());
  const previousGroups = useRef<ReadonlyMap<string, ArtifactGroup>>(new Map());

  useEffect(() => {
    const restoredInto = new Set<ArtifactGroup>(
      rows
        .filter(
          (row) => previousGroups.current.get(row.id) === 'deleted' && row.group !== 'deleted',
        )
        .map((row) => row.group),
    );
    previousGroups.current = new Map(rows.map((row) => [row.id, row.group]));
    if (restoredInto.size === 0) {
      return;
    }
    setClosedGroups((current) => new Set([...current].filter((group) => !restoredInto.has(group))));
  }, [rows]);

  const toggleGroup = useCallback((group: ArtifactGroup) => {
    setClosedGroups((current) => toggled({ set: current, value: group }));
  }, []);

  const toggleParts = useCallback((rowId: string) => {
    setOpenPartsIds((current) => toggled({ set: current, value: rowId }));
  }, []);

  return { closedGroups, openPartsIds, toggleGroup, toggleParts };
};

import type { PortRow } from '@goodboy/core';
import type { PortHolder, PortLayer } from '../actions/kinds/port';
import type { PortActionTarget } from '../actions/types';
import type { StartedRow } from './startedByGoodboy';

type PortParams = {
  readonly row: PortRow;
  readonly layer: PortLayer;
  readonly description: string;
  readonly ownerLabel: string | null;
  readonly isProcess?: boolean;
};

type SpawnParams = {
  readonly row: PortRow;
};

type StartedParams = {
  readonly row: StartedRow;
};

type HolderParams = {
  readonly row: PortRow;
  readonly ownerLabel: string | null;
};

const spawnIdOf = ({ row }: SpawnParams): string | null =>
  row.owner?.kind === 'script' || row.owner?.kind === 'terminal' || row.owner?.kind === 'agent'
    ? row.owner.spawnId
    : null;

const holderOf = ({ row, ownerLabel }: HolderParams): PortHolder | undefined =>
  row.pid === null
    ? undefined
    : {
        pid: row.pid,
        name: row.processName ?? `Process ${row.pid}`,
        spawnId: spawnIdOf({ row }),
        owner: ownerLabel,
      };

export const portTargetOf = ({
  row,
  layer,
  description,
  ownerLabel,
  isProcess = false,
}: PortParams): PortActionTarget => {
  const holder = holderOf({ row, ownerLabel });
  return {
    kind: 'port',
    facts: {
      port: isProcess ? null : row.port,
      layer,
      description,
      ...(holder !== undefined && { holder }),
    },
  };
};

export const startedTargetOf = ({ row }: StartedParams): PortActionTarget => ({
  kind: 'port',
  facts: {
    port: null,
    layer: 'goodboy',
    description: '',
    holder: {
      pid: row.pid,
      name: row.processName,
      spawnId: row.spawnId,
      owner: `${row.kindWord} · ${row.where}`,
    },
  },
});

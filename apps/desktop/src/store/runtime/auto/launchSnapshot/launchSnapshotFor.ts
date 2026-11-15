import { isUserPayload, kickoffGuidanceOf, storedDeliveryOf } from '@goodboy/core/auto';
import {
  getAutoArtifact,
  listAutoOutbox,
  readAutoArtifactLiveState,
  type AutoDelegation,
  type AutoOutboxRow,
  type AutoTree,
} from '@goodboy/db';
import { brandId, type ArtifactId, type MessageAttachment } from '@goodboy/types';
import { isRecord } from '@goodboy/types/helpers';
import type { LaunchSnapshotItem } from '../../../../features/auto/chat/launchSnapshotOf';
import { textFieldOf } from '../../../../shared/utils/textFieldOf';
import { userImagesOf } from '../userImagesOf';
import type { AgentVerbContext } from '../verbContext';
import { childRowsOf } from './childRowsOf';

const LAUNCH_SNAPSHOT_SCHEMA_VERSION = 1;

const LABEL_MAX = 80;

export type LaunchSnapshotEntry = LaunchSnapshotItem & Readonly<{ version: number | null }>;

export type LaunchSnapshot = Readonly<{
  schemaVersion: typeof LAUNCH_SNAPSHOT_SCHEMA_VERSION;
  items: ReadonlyArray<LaunchSnapshotEntry>;
  images: ReadonlyArray<MessageAttachment>;
  routing: Readonly<{ provider: string | null; model: string | null; effort: string | null }>;
}>;

type Params = {
  readonly ctx: AgentVerbContext;
  readonly tree: AutoTree;
  readonly delegation: AutoDelegation;
};

type LabelParams = {
  readonly text: string;
};

const snapshotLabelOf = ({ text }: LabelParams): string => {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > LABEL_MAX ? `${flat.slice(0, LABEL_MAX)}...` : flat;
};

type TurnParams = {
  readonly accepted: ReadonlyArray<AutoOutboxRow>;
};

const turnByRowIdOf = ({ accepted }: TurnParams): ReadonlyMap<string, number> => {
  const turns = new Map<string, number>();
  for (const row of accepted) {
    const stored = storedDeliveryOf({ value: row.payload });
    if (stored === null || stored.turn === undefined) {
      continue;
    }
    for (const rowId of stored.rowIds) {
      turns.set(rowId, stored.turn);
    }
  }
  return turns;
};

type NotesParams = {
  readonly rows: ReadonlyArray<AutoOutboxRow>;
  readonly turns: ReadonlyMap<string, number>;
};

const noteEntriesOf = ({ rows, turns }: NotesParams): ReadonlyArray<LaunchSnapshotEntry> =>
  rows.flatMap((row): ReadonlyArray<LaunchSnapshotEntry> => {
    if (!isUserPayload(row.payload) || row.payload.text.trim() === '') {
      return [];
    }
    const turn = turns.get(String(row.id));
    return [
      {
        kind: 'note',
        ref: String(row.id),
        version: null,
        label: snapshotLabelOf({ text: row.payload.text }),
        detail: turn === undefined ? 'your message' : `your note, read at turn ${turn}`,
      },
    ];
  });

type ImagesParams = {
  readonly images: ReadonlyArray<MessageAttachment>;
};

const imageEntriesOf = ({ images }: ImagesParams): ReadonlyArray<LaunchSnapshotEntry> =>
  images.map((image) => ({
    kind: 'image',
    ref: image.id,
    version: null,
    label: image.fileName,
    detail: 'an image you sent',
  }));

type ArtifactRef = Readonly<{
  artifactId: string;
  revision: number;
  isRevised: boolean;
}>;

type RequestParams = {
  readonly request: Readonly<Record<string, unknown>>;
};

const artifactRefsOf = ({ request }: RequestParams): ReadonlyArray<ArtifactRef> => {
  const refs: Array<ArtifactRef> = [];
  const capture = request['capture'];
  if (
    isRecord(capture) &&
    capture['mode'] === 'revise' &&
    typeof capture['artifactId'] === 'string' &&
    typeof capture['baseRevision'] === 'number'
  ) {
    refs.push({
      artifactId: capture['artifactId'],
      revision: capture['baseRevision'],
      isRevised: true,
    });
  }
  const inputs = request['inputArtifacts'];
  for (const input of Array.isArray(inputs) ? inputs : []) {
    if (
      isRecord(input) &&
      typeof input['artifactId'] === 'string' &&
      typeof input['revision'] === 'number' &&
      input['revision'] > 0
    ) {
      refs.push({ artifactId: input['artifactId'], revision: input['revision'], isRevised: false });
    }
  }
  return refs;
};

type ArtifactParams = {
  readonly ctx: AgentVerbContext;
  readonly ref: ArtifactRef;
};

const artifactEntryOf = async ({ ctx, ref }: ArtifactParams): Promise<LaunchSnapshotEntry> => {
  const artifactId = brandId<ArtifactId>({ value: ref.artifactId });
  const [registered, live] = await Promise.all([
    getAutoArtifact({ db: ctx.db, artifactId }),
    readAutoArtifactLiveState({ db: ctx.db, artifactId }),
  ]);
  const kind = registered?.kind ?? 'artifact';
  const version = `${kind}, version ${ref.revision}`;
  return {
    kind: 'artifact',
    ref: `${ref.artifactId}@${ref.revision}`,
    version: ref.revision,
    label: snapshotLabelOf({ text: live?.title ?? ref.artifactId }),
    detail: ref.isRevised ? `${version}, to revise` : version,
  };
};

const guidanceEntriesOf = ({ request }: RequestParams): ReadonlyArray<LaunchSnapshotEntry> => {
  const kickoff = request['kickoff'];
  const guidance = typeof kickoff === 'string' ? kickoffGuidanceOf({ kickoff }) : null;
  return guidance === null
    ? []
    : [
        {
          kind: 'guidance',
          ref: 'guidance',
          version: null,
          label: snapshotLabelOf({ text: guidance }),
          detail: 'run guidance',
        },
      ];
};

export const launchSnapshotFor = async ({
  ctx,
  tree,
  delegation,
}: Params): Promise<LaunchSnapshot> => {
  const accepted = await listAutoOutbox({ db: ctx.db, treeId: tree.id, states: ['accepted'] });
  const rows = childRowsOf({ accepted, tree, delegation });
  const images = userImagesOf({ rows });
  const artifacts = await Promise.all(
    artifactRefsOf({ request: delegation.request }).map((ref) => artifactEntryOf({ ctx, ref })),
  );
  return {
    schemaVersion: LAUNCH_SNAPSHOT_SCHEMA_VERSION,
    items: [
      ...noteEntriesOf({ rows, turns: turnByRowIdOf({ accepted }) }),
      ...imageEntriesOf({ images }),
      ...artifacts,
      ...guidanceEntriesOf({ request: delegation.request }),
    ],
    images,
    routing: {
      provider: textFieldOf({ source: delegation.routing, key: 'provider' }),
      model: textFieldOf({ source: delegation.routing, key: 'model' }),
      effort: textFieldOf({ source: delegation.routing, key: 'effort' }),
    },
  };
};

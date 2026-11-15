import { isJsonRecord, listField, textField } from './readJson';

export type LaunchSnapshotKind = 'note' | 'result' | 'guidance' | 'image' | 'artifact';

export type LaunchSnapshotItem = Readonly<{
  kind: LaunchSnapshotKind;
  ref: string;
  label: string;
  detail: string | null;
}>;

const KINDS: ReadonlyArray<LaunchSnapshotKind> = [
  'note',
  'result',
  'guidance',
  'image',
  'artifact',
];

type KindParams = {
  readonly value: string | null;
};

const snapshotKindOf = ({ value }: KindParams): LaunchSnapshotKind | null =>
  KINDS.find((kind) => kind === value) ?? null;

type Params = {
  readonly snapshot: unknown;
};

export const launchSnapshotOf = ({
  snapshot,
}: Params): ReadonlyArray<LaunchSnapshotItem> | null => {
  if (!isJsonRecord(snapshot) || !Array.isArray(snapshot['items'])) {
    return null;
  }
  const items: Array<LaunchSnapshotItem> = [];
  for (const [index, entry] of listField({ source: snapshot, key: 'items' }).entries()) {
    const kind = snapshotKindOf({ value: textField({ source: entry, key: 'kind' }) });
    const label = textField({ source: entry, key: 'label' });
    if (kind === null || label === null) {
      continue;
    }
    items.push({
      kind,
      ref: textField({ source: entry, key: 'ref' }) ?? `${kind}-${index}`,
      label,
      detail: textField({ source: entry, key: 'detail' }),
    });
  }
  return items;
};

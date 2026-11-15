import { isJsonRecord, listField, textField } from './readJson';

export type LaunchSnapshotKind = 'note' | 'result' | 'guidance' | 'image' | 'artifact';

export type LaunchSnapshotItem = Readonly<{
  kind: LaunchSnapshotKind;
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
  readonly request: unknown;
};

export const launchSnapshotOf = ({ request }: Params): ReadonlyArray<LaunchSnapshotItem> | null => {
  if (!isJsonRecord(request) || !Array.isArray(request['launchSnapshot'])) {
    return null;
  }
  const items: Array<LaunchSnapshotItem> = [];
  for (const entry of listField({ source: request, key: 'launchSnapshot' })) {
    const kind = snapshotKindOf({ value: textField({ source: entry, key: 'kind' }) });
    const label = textField({ source: entry, key: 'label' });
    if (kind === null || label === null) {
      continue;
    }
    items.push({ kind, label, detail: textField({ source: entry, key: 'detail' }) });
  }
  return items;
};

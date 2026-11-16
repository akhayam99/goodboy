import type { WorkspaceId } from '@goodboy/types';
import { STORAGE_PREFIXES, persistedPref } from '../../../../../shared/lib/storage-keys';
import { storageKeyOf } from '../../../../../shared/lib/storageKeyOf';
import { INBOX_PROVIDERS } from '../../../../inbox/types';
import type { TaskPickerSource } from './taskPickerView';

type Params = {
  readonly workspaceId: WorkspaceId;
};

type ChoicesParams = {
  readonly choices: ReadonlyArray<TaskPickerSource>;
};

const SOURCES: ReadonlyArray<TaskPickerSource> = ['all', ...INBOX_PROVIDERS];

const sourceParser =
  ({ choices }: ChoicesParams) =>
  (raw: string): TaskPickerSource | undefined =>
    choices.find((choice) => choice === raw);

export const taskPickerSourcePref = ({ workspaceId }: Params) =>
  persistedPref<TaskPickerSource>({
    key: storageKeyOf({ prefix: STORAGE_PREFIXES.taskPickerSource, id: workspaceId }),
    fallback: 'all',
    parse: sourceParser({ choices: SOURCES }),
    serialize: String,
  });

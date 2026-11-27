import { Chip } from '@goodboy/ui';
import type { DiffThread } from './types';

type Props = {
  readonly thread: DiffThread;
};

const OUTDATED_WORD = 'Outdated';

export const ThreadOutdatedChip = ({ thread }: Props) =>
  thread.isOutdated === true && thread.statusLabel !== OUTDATED_WORD ? (
    <Chip tone="neutral" kind="state" bordered={false} label={OUTDATED_WORD} />
  ) : null;

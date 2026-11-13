import { Chip } from '@goodboy/ui';
import { openCountWord } from '../../../openCountWord';
import type { InboxRecord } from '../../../types';

type Props = {
  readonly records: ReadonlyArray<Pick<InboxRecord, 'state' | 'key'>>;
  readonly newKeys?: ReadonlySet<string>;
};

export const TasksCountChip = ({ records, newKeys }: Props) => (
  <Chip
    kind="state"
    tone="neutral"
    emphasis="subtle"
    bordered={false}
    testId="tasks-count"
    label={openCountWord({ records, ...(newKeys !== undefined && { newKeys }) })}
  />
);

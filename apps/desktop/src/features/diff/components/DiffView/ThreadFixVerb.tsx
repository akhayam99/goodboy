import { ObjectActionVerb } from '../../../actions/ObjectActionVerb';
import type { DiffThread } from './types';

type Props = {
  readonly thread: DiffThread;
};

export const ThreadFixVerb = ({ thread }: Props) =>
  thread.fixTarget === undefined || thread.isResolved ? null : (
    <ObjectActionVerb
      target={{ kind: 'reviewComment', ...thread.fixTarget }}
      actionId="reviewComment.draft"
    />
  );

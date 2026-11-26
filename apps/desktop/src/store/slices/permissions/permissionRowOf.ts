import type { UserOrigin } from '@goodboy/core/auto';
import type { AnsweredAsk } from '../../../features/permissions/askBatchOf';
import { heldReasonsOf } from './heldReasonsOf';

type Params = {
  readonly held: ReadonlyArray<AnsweredAsk>;
  readonly reason?: string;
};

type PermissionRow = Readonly<{
  rowOrigin: UserOrigin;
  userText?: string;
}>;

export const permissionRowOf = ({ held, reason = '' }: Params): PermissionRow => {
  const userText = [...heldReasonsOf({ held }), reason.trim()]
    .filter((words) => words !== '')
    .join('\n');
  return { rowOrigin: 'permission', ...(userText !== '' && { userText }) };
};

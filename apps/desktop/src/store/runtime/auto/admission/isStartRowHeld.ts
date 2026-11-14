import type { AutoDelegationRole } from '@goodboy/core/auto';
import { casAutoDelegationStateStatement, type AutoDelegation } from '@goodboy/db';
import type { AgentVerbContext } from '../verbContext';
import { admissionStateOf } from './admissionStateOf';
import { readAdmissionPermissions } from './readAdmissionPermissions';

const ABORT_HOLD = 'start_row_hold';

type Params = {
  readonly ctx: AgentVerbContext;
  readonly delegation: AutoDelegation;
  readonly role: AutoDelegationRole;
};

export const isStartRowHeld = async ({ ctx, delegation, role }: Params): Promise<boolean> => {
  if (delegation.request['isStartConfirmed'] === true) {
    return false;
  }
  const permissions = await readAdmissionPermissions({ db: ctx.db, treeId: delegation.treeId });
  if (admissionStateOf({ permissions, role, isConfirmForced: false }) !== 'awaiting_confirm') {
    return false;
  }
  const nowMs = ctx.now();
  await ctx.db.transaction({
    statements: [
      casAutoDelegationStateStatement({
        delegationId: delegation.id,
        generation: delegation.generation,
        from: ['accepted'],
        to: 'awaiting_confirm',
        abortCode: ABORT_HOLD,
      }),
      {
        sql: 'UPDATE auto_trees SET phase_rev = phase_rev + 1, updated_at = ? WHERE id = ?',
        params: [nowMs, delegation.treeId],
      },
    ],
  });
  return true;
};

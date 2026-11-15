import type { ComponentType } from 'react';
import { leadPermissionsOf, type StoredLeadPermissionRows } from '@goodboy/core/auto';
import { FLOATING_SURFACE, cn } from '@goodboy/ui';
import { LeadPermissionsPanel } from '../../../../../features/auto/permissions/LeadPermissionsPanel';

type SceneParams = {
  readonly leadRows: StoredLeadPermissionRows;
  readonly subtitle: string;
};

const sceneOf = ({ leadRows, subtitle }: SceneParams) => {
  const permissions = leadPermissionsOf({
    leadRows,
    defaultRows: {},
    sessionLevel: 'plan',
    workspaceLevel: null,
    isPlanApprovalOff: false,
    isWorkFlowOn: true,
    spendLimitUsd: 10,
  });
  return (
    <div className="flex min-h-screen items-start justify-center bg-background p-6">
      <section aria-label={subtitle} className={cn(FLOATING_SURFACE, 'flex w-125 flex-col')}>
        <LeadPermissionsPanel
          permissions={permissions}
          scope="lead"
          rowErrors={{}}
          presetError={null}
          isDisabled={false}
          onChange={() => undefined}
          onReset={() => undefined}
          onPreset={() => undefined}
          onScope={() => undefined}
        />
      </section>
    </div>
  );
};

export const U42_WORK_PERMISSIONS_SCENES: Readonly<Record<string, ComponentType>> = {
  'work-permissions': () =>
    sceneOf({
      leadRows: {},
      subtitle: 'Stop retried webhooks posting a second credit · follows the workspace default',
    }),
  'work-permissions-custom': () =>
    sceneOf({
      leadRows: { push: 'ask', dependencies: 'ask' },
      subtitle: 'Stop retried webhooks posting a second credit · 2 changes on this Lead',
    }),
};

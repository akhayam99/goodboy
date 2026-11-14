import type { ComponentType } from 'react';
import { leadPermissionsOf, type StoredLeadPermissionRows } from '@goodboy/core/auto';
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
      <section
        aria-label="Asks you"
        className="flex w-[640px] flex-col gap-4 rounded-md border border-border-soft bg-subtle p-5"
      >
        <header className="flex flex-col gap-0.5">
          <h2 className="text-title text-foreground">Asks you</h2>
          <p className="text-meta text-muted-foreground">{subtitle}</p>
        </header>
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

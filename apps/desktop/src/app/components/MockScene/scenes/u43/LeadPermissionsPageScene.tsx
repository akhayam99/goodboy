import { useEffect } from 'react';
import { leadPermissionsOf, type StoredLeadPermissionRows } from '@goodboy/core/auto';
import { useAppStore } from '../../../../../store';
import { RunPageScene } from '../surfaces/run-page/RunPageScene';

type Props = {
  readonly leadRows: StoredLeadPermissionRows;
  readonly isOpen: boolean;
};

const OPEN_ROW_AFTER_MS = 400;
const OPEN_PANEL_AFTER_MS = 900;

type ClickParams = {
  readonly selector: string;
};

const clickOn = ({ selector }: ClickParams): void => {
  document.querySelector<HTMLElement>(selector)?.click();
};

export const LeadPermissionsPageScene = ({ leadRows, isOpen }: Props) => {
  useEffect(() => {
    const permissions = leadPermissionsOf({
      leadRows,
      defaultRows: {},
      sessionLevel: 'plan',
      workspaceLevel: null,
      isPlanApprovalOff: false,
      isWorkFlowOn: true,
      spendLimitUsd: 10,
    });
    useAppStore.setState({ readLeadPermissions: async () => permissions });
    const openRow = () => clickOn({ selector: 'button[aria-label="Run settings"]' });
    const openPanel = () => clickOn({ selector: '[data-setting-chip="Asks you"]' });
    const timers = [setTimeout(openRow, OPEN_ROW_AFTER_MS)];
    if (isOpen) {
      timers.push(setTimeout(openPanel, OPEN_PANEL_AFTER_MS));
    }
    return () => timers.forEach((timer) => clearTimeout(timer));
  }, [leadRows, isOpen]);
  return <RunPageScene state="working" theme="dark" isLead />;
};

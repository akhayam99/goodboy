import { useEffect } from 'react';
import { leadPermissionsOf, type StoredLeadPermissionRows } from '@goodboy/core/auto';
import { useAppStore } from '../../../../../store';
import { RunPageScene } from '../surfaces/run-page/RunPageScene';

type LeadPermissionsStep = 'head' | 'menu' | 'drawer';

type Props = {
  readonly leadRows: StoredLeadPermissionRows;
  readonly step: LeadPermissionsStep;
};

const OPEN_ROW_AFTER_MS = 400;
const OPEN_MENU_AFTER_MS = 900;
const OPEN_DRAWER_AFTER_MS = 1300;

type ClickParams = {
  readonly selector: string;
};

const clickOn = ({ selector }: ClickParams): void => {
  document.querySelector<HTMLElement>(selector)?.click();
};

export const LeadPermissionsPageScene = ({ leadRows, step }: Props) => {
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
    const openMenu = () => clickOn({ selector: '[data-setting-chip="Stops for your OK"]' });
    const openDrawer = () =>
      clickOn({ selector: '[role="menuitem"][data-menu-label="Fine-tune this run"]' });
    const timers = [setTimeout(openRow, OPEN_ROW_AFTER_MS)];
    if (step !== 'head') {
      timers.push(setTimeout(openMenu, OPEN_MENU_AFTER_MS));
    }
    if (step === 'drawer') {
      timers.push(setTimeout(openDrawer, OPEN_DRAWER_AFTER_MS));
    }
    return () => timers.forEach((timer) => clearTimeout(timer));
  }, [leadRows, step]);
  return <RunPageScene state="working" theme="dark" isLead />;
};

import type { DrawerRegistration } from '../../store/slices/drawer/drawerRegistration';
import { PlanPartDrawer } from './components/PlanParts/PlanPartDrawer';

export const planPartDrawerRegistration: DrawerRegistration<'plan-part'> = {
  kind: 'plan-part',
  render: ({ drawer, closeDrawer }) => (
    <PlanPartDrawer
      sessionId={drawer.sessionId}
      planId={drawer.payload.planId}
      index={drawer.payload.index}
      onClose={closeDrawer}
    />
  ),
};

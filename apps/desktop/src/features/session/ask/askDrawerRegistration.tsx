import { DrawerFrame, EmptyLine } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import type { DrawerRegistration } from '../../../store/slices/drawer/drawerRegistration';
import { AskPane } from './components/AskPane';

export const askDrawerRegistration: DrawerRegistration<'ask'> = {
  kind: 'ask',
  render: ({ drawer, closeDrawer }) =>
    drawer.sessionId === null ? (
      <DrawerFrame isDock title="Ask" icon={CONCEPT_ICONS.ask} onClose={closeDrawer}>
        <EmptyLine>Open a session to ask about it.</EmptyLine>
      </DrawerFrame>
    ) : (
      <AskPane key={drawer.sessionId} sessionId={drawer.sessionId} onClose={closeDrawer} />
    ),
};

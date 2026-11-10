import type { SessionId } from '@goodboy/types';
import { browserStudioPlace } from '../../../features/browser/browserStudioPlace';
import { terminalStudioPlace } from '../../../features/terminal/terminalStudioPlace';
import type { StudioDestinationId } from '../../../shared/navigation/destinations';
import { selectChatDoor, type DoorState } from '../chat-last-open/selectChatDoor';
import type { StudioPlace } from './studio';

type Params = {
  readonly id: StudioDestinationId;
  readonly sessionId: SessionId | null;
  readonly state: DoorState;
};

export const destinationStudioOf = ({ id, sessionId, state }: Params): StudioPlace => {
  switch (id) {
    case 'inbox':
      return { kind: 'inbox', focus: null };
    case 'workflows':
      return { kind: 'workflow' };
    case 'chat':
      return { kind: 'chat', chatId: selectChatDoor({ state }) };
    case 'impact':
      return { kind: 'impact', scope: null };
    case 'terminal':
      return terminalStudioPlace({ sessionId });
    case 'browser':
      return browserStudioPlace({ sessionId });
    case 'monitoring':
      return { kind: 'monitoring' };
    case 'notifications':
      return { kind: 'notifications' };
    case 'settings':
      return { kind: 'settings', focus: { scope: 'home' } };
    case 'guide':
      return { kind: 'guide' };
    case 'whatsNew':
      return { kind: 'changelog' };
    default: {
      const unreachable: never = id;
      return unreachable;
    }
  }
};

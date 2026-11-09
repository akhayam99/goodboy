import type { SessionId } from '@goodboy/types';
import { browserStudioPlace } from '../../../features/browser/browserStudioPlace';
import { terminalStudioPlace } from '../../../features/terminal/terminalStudioPlace';
import type { StudioDestinationId } from '../../../shared/navigation/destinations';
import { selectChatDoor, type DoorState } from '../chat-last-open/selectChatDoor';
import type { StudioPlace } from './studio';

type Params = {
  readonly id: StudioDestinationId;
  readonly state: DoorState & { readonly currentSessionId: SessionId | null };
};

export const destinationStudioOf = ({ id, state }: Params): StudioPlace => {
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
      return terminalStudioPlace({ sessionId: state.currentSessionId });
    case 'browser':
      return browserStudioPlace({ sessionId: state.currentSessionId });
    case 'monitoring':
      return { kind: 'monitoring' };
    case 'notifications':
      return { kind: 'notifications' };
    default: {
      const unreachable: never = id;
      return unreachable;
    }
  }
};

import type { PageDestinationId } from '../../../shared/navigation/destinations';
import { selectChatDoor, type DoorState } from '../chat-last-open/selectChatDoor';
import type { StudioPlace } from './studio';

type Params = {
  readonly id: PageDestinationId;
  readonly state: DoorState;
};

export const destinationStudioOf = ({ id, state }: Params): StudioPlace => {
  switch (id) {
    case 'inbox':
      return { kind: 'inbox', focus: null };
    case 'work':
      return { kind: 'work' };
    case 'workflows':
      return { kind: 'workflow' };
    case 'chat':
      return { kind: 'chat', chatId: selectChatDoor({ state }) };
    case 'impact':
      return { kind: 'impact', scope: null };
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

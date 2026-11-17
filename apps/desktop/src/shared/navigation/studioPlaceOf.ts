import type { StudioKind } from '../../store';
import type { ColumnPlace } from './columnPlace';

type StudioParams = {
  readonly studio: StudioKind;
};

export const studioPlaceOf = ({ studio }: StudioParams): ColumnPlace => {
  switch (studio) {
    case 'inbox':
      return 'inbox';
    case 'chat':
      return 'chat';
    case 'connections':
      return 'connections';
    case 'workflow':
      return 'workflows';
    case 'terminal':
      return 'terminal';
    case 'browser':
      return 'browser';
    case 'monitoring':
      return 'monitoring';
    case 'settings':
      return 'settings';
    case 'impact':
      return 'impact';
    case 'guide':
    case 'changelog':
      return 'help';
    case 'notifications':
      return 'notifications';
    case 'addWorkspace':
      return 'addWorkspace';
    default: {
      const unreachable: never = studio;
      return unreachable;
    }
  }
};

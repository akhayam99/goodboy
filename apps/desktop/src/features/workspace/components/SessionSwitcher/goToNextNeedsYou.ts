import type { AppStore } from '../../../../store/store';
import { attentionPlace } from '../../../session/attentionPlace';
import { sessionTitle } from '../../../../shared/utils/sessionTitle';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';
import { announceNeedsYou } from './announceNeedsYou';
import { nextNeedsYou } from './nextNeedsYou';

type Params = {
  readonly state: AppStore;
};

export const goToNextNeedsYou = ({ state }: Params): void => {
  const target = nextNeedsYou({ state });
  if (target === null) {
    const workspace = state.workspaces.find(
      (candidate) => candidate.id === state.currentWorkspaceId,
    );
    announceNeedsYou({
      text:
        workspace === undefined ? 'Nothing needs you' : `Nothing needs you in ${workspace.name}`,
    });
    return;
  }
  state.navigate({
    to: attentionPlace({ state, sessionId: target.sessionId, reason: target.reason }),
  });
  if (target.isOnlyOne) {
    announceNeedsYou({ text: 'This is the only one' });
    return;
  }
  if (target.isOutsideFilter) {
    const session = sessionById(state.sessions, target.sessionId);
    announceNeedsYou({
      text: `Opened ${sessionTitle({ session })}, outside your project filter`,
    });
  }
};

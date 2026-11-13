import { NOTHING_CHANGED } from '../../store/slices/notifications/errorRecovery';
import { selectActiveMount } from '../../store/slices/project-mounts/selectors';
import { useAppStore } from '../../store';
import { fileHrefOf } from '../open/fileHrefOf';
import { openTarget } from '../open/openTarget';
import { sessionOfElement } from './sessionOfElement';

type Params = {
  readonly href: string;
  readonly anchor: Element;
  readonly event: MouseEvent;
};

const WEB_RE = /^https?:/i;

export const claimSessionLink = ({ href, anchor, event }: Params): boolean => {
  const sessionId = sessionOfElement({ element: anchor });
  if (WEB_RE.test(href)) {
    void openTarget({ target: { kind: 'web', url: href }, sessionId, event });
    return true;
  }
  const file = fileHrefOf({ href });
  if (file === null) {
    return false;
  }
  const state = useAppStore.getState();
  const root =
    sessionId === null ? null : (selectActiveMount({ state, sessionId })?.worktreePath ?? '');
  if (root === null || root === '') {
    void state.reportError({
      recovery: NOTHING_CHANGED,
      title: "Couldn't open the file",
      error: new Error(`${file.path} has no folder to open from.`),
      severity: 'warning',
    });
    return true;
  }
  void openTarget({
    target: { kind: 'file', path: file.path, root, line: file.line },
    sessionId,
    event,
  });
  return true;
};

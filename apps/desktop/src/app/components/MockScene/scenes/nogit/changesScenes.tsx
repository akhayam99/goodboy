import { ChangesScene } from './ChangesScene';

export const NOGIT_CHANGES_SCENES = {
  'u26-nogit-changes-list-dark': () => <ChangesScene theme="dark" view="list" />,
  'u26-nogit-changes-list-light': () => <ChangesScene theme="light" view="list" />,
  'u26-nogit-changes-conflict-dark': () => <ChangesScene theme="dark" view="conflict" />,
  'u26-nogit-changes-conflict-light': () => <ChangesScene theme="light" view="conflict" />,
  'u26-nogit-changes-restored-dark': () => <ChangesScene theme="dark" view="restored" />,
  'u26-nogit-changes-restored-light': () => <ChangesScene theme="light" view="restored" />,
  'u26-nogit-changes-added-dark': () => <ChangesScene theme="dark" view="added" />,
  'u26-nogit-changes-added-light': () => <ChangesScene theme="light" view="added" />,
  'u26-nogit-session-overview-dark': () => <ChangesScene theme="dark" view="overview" />,
  'u26-nogit-session-overview-light': () => <ChangesScene theme="light" view="overview" />,
  'u26-nogit-session-chat-dark': () => <ChangesScene theme="dark" view="chat" />,
  'u26-nogit-session-chat-light': () => <ChangesScene theme="light" view="chat" />,
};

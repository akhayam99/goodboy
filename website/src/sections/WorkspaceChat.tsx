import { Chapter } from '../components/Chapter';
import { Fragment } from '../components/Fragment';
import { WORKSPACE_CHAT } from '../figures';
import { SITE } from '../site';

export const WorkspaceChat = () => (
  <Chapter id="ask" label="Workspace chat" isBand>
    <Fragment
      id="workspace-chat"
      eyebrow="Agents"
      heading="Ask about the code before any task"
      body="No session, no brief, and if you really need it, a chat. Chat, next to Board, reads every project in the workspace and never changes a file. Pick Claude or Codex for each conversation, or type your question in ⌘K. When an answer turns into work, Start work drafts the brief for a new session."
      link={{ href: `${SITE.featureGuide}#workspace-chat`, label: 'How the workspace chat works' }}
      figures={[WORKSPACE_CHAT]}
      isMirrored
    />
  </Chapter>
);

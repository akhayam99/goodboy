import { ActionPanelScene } from './confirm-sweep-a/ActionPanelScene';
import { ChatDeleteScene } from './confirm-sweep-a/ChatDeleteScene';
import { SessionDeleteScene } from './confirm-sweep-a/SessionDeleteScene';
import { WorktreeRemoveScene } from './confirm-sweep-a/WorktreeRemoveScene';

export const U24_CONFIRM_SWEEP_A_SCENES = {
  'confirm-session-delete': SessionDeleteScene,
  'confirm-chat-delete': ChatDeleteScene,
  'confirm-worktree-remove': WorktreeRemoveScene,
  'confirm-action-panel': ActionPanelScene,
};

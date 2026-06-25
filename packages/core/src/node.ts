export {
  createWorktree,
  listWorktrees,
  removeWorktree,
  sanitizeSlug,
  GitError,
  WorktreeError,
  type CreatedWorktree,
  type CreateWorktreeOptions,
  type WorktreeInfo,
} from './worktree'

export { ClaudeAdapter, type ClaudeAdapterDeps } from './providers/claude'

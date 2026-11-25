import type { Guide } from '../Guide';
import { AGENT_COSTS_GUIDE } from './agentCostsGuide';
import { AGENTS_TOGETHER_GUIDE } from './agentsTogetherGuide';
import { CONTEXT_HANDOFF_GUIDE } from './contextHandoffGuide';
import { GLOSSARY_GUIDE } from './glossaryGuide';
import { MULTI_REPO_GUIDE } from './multiRepoGuide';
import { PARALLEL_AGENTS_GUIDE } from './parallelAgentsGuide';
import { REVIEW_COMMENTS_GUIDE } from './reviewCommentsGuide';
import { WORKTREES_GUIDE } from './worktreesGuide';

export const GUIDES: readonly Guide[] = [
  WORKTREES_GUIDE,
  PARALLEL_AGENTS_GUIDE,
  REVIEW_COMMENTS_GUIDE,
  CONTEXT_HANDOFF_GUIDE,
  AGENT_COSTS_GUIDE,
  AGENTS_TOGETHER_GUIDE,
  MULTI_REPO_GUIDE,
  GLOSSARY_GUIDE,
];

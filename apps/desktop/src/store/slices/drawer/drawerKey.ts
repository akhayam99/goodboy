import type { DrawerContent } from './state';

export const drawerKey = (content: DrawerContent): string => {
  switch (content.kind) {
    case 'check-analysis':
      return `check-analysis:${content.payload.sessionId}:${content.payload.checkUrl}`;
    case 'context':
      return 'context';
    case 'explore-file':
      return `explore-file:${content.payload.sessionDir}:${content.payload.entry.relPath}`;
    case 'artifact':
      return `artifact:${content.payload.artifactId}:${content.payload.tab}`;
    case 'artifact-document':
      return `artifact-document:${content.payload.artifactId}:${content.payload.revision ?? 'current'}`;
    case 'plan-part':
      return `plan-part:${content.payload.planId}:${content.payload.index}`;
    case 'scriptRun':
      return `scriptRun:${content.payload.mountId ?? ''}:${content.payload.scriptKey}`;
    case 'explore':
      return 'explore';
    case 'scripts':
      return 'scripts';
    case 'conversation':
      return `conversation:${content.payload.threadId}`;
    case 'ask':
      return 'ask';
    case 'question':
      return `question:${content.payload.questionId}`;
    case 'new':
      return 'new';
    case 'transcript':
      return `transcript:${content.payload.agentId}`;
    case 'auto-child':
      return `auto-child:${content.payload.agentId}`;
    case 'run-step':
      return `run-step:${content.payload.runId}:${content.payload.agentId}`;
    case 'fix-comments':
      return `fix-comments:${content.payload.mountId ?? ''}`;
    case 'terminal':
      return `terminal:${content.payload.terminalId}`;
    case 'history-versions':
      return `history-versions:${content.payload.mountId}`;
    case 'file-diff':
      return `file-diff:${
        content.payload.source.kind === 'commit'
          ? `${content.payload.source.repo}@${content.payload.source.sha}`
          : content.payload.source.worktreePath
      }:${content.payload.path ?? ''}${content.payload.whole === undefined ? '' : ':whole'}`;
    default: {
      const exhaustive: never = content;
      return String(exhaustive);
    }
  }
};

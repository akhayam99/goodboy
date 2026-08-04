import type { ResolverActionKind } from './resolverActions';

export const RESOLVER_ACTION_BUSY_LABEL: Record<ResolverActionKind, string> = {
  push: 'Pushing...',
  queue: 'Adding...',
  dequeue: 'Removing...',
  explain: 'Posting...',
  proceed: 'Sending...',
  answer: 'Opening...',
  review: 'Opening...',
  run: 'Starting...',
  rerun: 'Starting...',
  fix: 'Sending...',
  forceClose: 'Closing...',
  forceResolve: 'Resolving...',
};

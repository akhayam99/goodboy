import {
  ArrowRight,
  CheckCheck,
  CircleStop,
  Clock,
  Hammer,
  ListChecks,
  MessageSquareReply,
  Play,
  RotateCcw,
  Upload,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { ResolverActionKind } from './resolverActions';

export const RESOLVER_ACTION_ICON: Record<ResolverActionKind, LucideIcon> = {
  push: Upload,
  queue: Clock,
  dequeue: X,
  explain: MessageSquareReply,
  proceed: Play,
  answer: ArrowRight,
  review: ListChecks,
  run: Play,
  rerun: RotateCcw,
  fix: Hammer,
  forceClose: CircleStop,
  forceResolve: CheckCheck,
};

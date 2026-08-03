import {
  ArrowRight,
  CheckCheck,
  CircleStop,
  Clock,
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
  run: Play,
  rerun: RotateCcw,
  forceClose: CircleStop,
  forceResolve: CheckCheck,
};

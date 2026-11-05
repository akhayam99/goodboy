import type { CSSProperties } from 'react';
import './kit.css';
import {
  BookOpen,
  Bot,
  BugPlay,
  CodeXml,
  Feather,
  FileText,
  FlaskConical,
  GitGraph,
  GitPullRequestArrow,
  MapIcon,
  MessageSquareReply,
  PanelsTopLeft,
  ScanEye,
  Telescope,
  type IconComponent,
} from '../icons';
import { AGENT_KIND_PALETTE, UNKNOWN_KIND_COLOR, type AgentKind } from './spec';
import { cx } from './cx';

type Props = {
  readonly kind: AgentKind | 'unknown';
  readonly className?: string;
};

const KIND_ICON: Record<AgentKind, IconComponent> = {
  scout: Telescope,
  planner: MapIcon,
  implementer: CodeXml,
  debugger: BugPlay,
  tester: FlaskConical,
  reviewer: ScanEye,
  'pr-reviewer': GitPullRequestArrow,
  docs: BookOpen,
  report: FileText,
  wireframe: PanelsTopLeft,
  resolver: MessageSquareReply,
  rewriter: GitGraph,
  scribe: Feather,
  generic: Bot,
};

const GLYPH_ICON_SIZE = 10;
const UNKNOWN_KIND_LABEL = 'Agent';

export const KindGlyph = ({ kind, className }: Props) => {
  const palette = kind === 'unknown' ? null : AGENT_KIND_PALETTE[kind];
  const label = palette?.label ?? UNKNOWN_KIND_LABEL;
  const Icon = kind === 'unknown' ? Bot : KIND_ICON[kind];
  const style = { '--gk-kind': palette?.color ?? UNKNOWN_KIND_COLOR } as CSSProperties;
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cx('gkKindGlyph', className)}
      data-kind={kind}
      style={style}
    >
      <Icon size={GLYPH_ICON_SIZE} />
    </span>
  );
};

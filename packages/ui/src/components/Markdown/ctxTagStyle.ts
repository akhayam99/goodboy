import {
  Activity,
  CheckCheck,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleX,
  FileEdit,
  HelpCircle,
  Info,
  Target,
  TextQuote,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../../cn';
import { tintClasses, type Tone } from '../../tint';

export type CtxTone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'muted';

type CtxTagStyle = {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly tone: CtxTone;
  readonly iconClass: string;
  readonly chipClass: string;
  readonly railClass: string;
};

type ToneClasses = Pick<CtxTagStyle, 'iconClass' | 'chipClass' | 'railClass'>;

const tinted = (tone: Tone): ToneClasses => {
  const tint = tintClasses(tone);
  return {
    iconClass: tint.icon,
    chipClass: cn(tint.bg, tint.text),
    railClass: tint.dot,
  };
};

const TONE_CLASSES: Record<CtxTone, ToneClasses> = {
  primary: tinted('primary'),
  success: tinted('success'),
  warning: tinted('warning'),
  danger: tinted('danger'),
  info: tinted('info'),
  muted: {
    iconClass: 'text-muted-foreground',
    chipClass: 'bg-muted text-muted-foreground',
    railClass: 'bg-border',
  },
};

type TagSpec = {
  readonly match: RegExp;
  readonly icon: LucideIcon;
  readonly label: string;
  readonly tone: CtxTone;
};

const TAG_SPECS: ReadonlyArray<TagSpec> = [
  { match: /^goal$/i, icon: Target, label: 'goal', tone: 'muted' },
  { match: /^(summary|tl-?dr)$/i, icon: TextQuote, label: 'summary', tone: 'muted' },
  { match: /^(decision|decisions)$/i, icon: CheckCheck, label: 'decision', tone: 'muted' },
  {
    match: /^(question|questions|open-?questions)$/i,
    icon: HelpCircle,
    label: 'question',
    tone: 'warning',
  },
  { match: /^(risk|risks|warning)$/i, icon: TriangleAlert, label: 'risk', tone: 'warning' },
  { match: /^(note|notes)$/i, icon: Info, label: 'note', tone: 'muted' },
  {
    match: /^(output|last-?output|last-?output-?summary)$/i,
    icon: Activity,
    label: 'output',
    tone: 'info',
  },
  { match: /^(files?|files-?touched)$/i, icon: FileEdit, label: 'files', tone: 'info' },
  { match: /^(ok|pass|passed|done|shipped)$/i, icon: CircleCheck, label: 'ok', tone: 'success' },
  { match: /^(warn|partial|flaky)$/i, icon: CircleAlert, label: 'warn', tone: 'warning' },
  { match: /^(fail|failed|blocked|error)$/i, icon: CircleX, label: 'fail', tone: 'danger' },
  { match: /^(todo|open|pending|skipped)$/i, icon: CircleDashed, label: 'todo', tone: 'muted' },
  { match: /^info$/i, icon: Info, label: 'info', tone: 'info' },
];

type TagParams = {
  readonly tag: string;
};

export const ctxStyleForTag = ({ tag }: TagParams): CtxTagStyle => {
  const stripped = tag.replace(/^ctx-?/i, '');
  const spec = TAG_SPECS.find(({ match }) => match.test(stripped));
  if (spec === undefined) {
    return { icon: Activity, label: stripped || tag, tone: 'muted', ...TONE_CLASSES.muted };
  }
  return { icon: spec.icon, label: spec.label, tone: spec.tone, ...TONE_CLASSES[spec.tone] };
};

export const ctxTagLabel = ({ tag }: TagParams): string => ctxStyleForTag({ tag }).label;

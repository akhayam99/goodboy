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

export type CtxTone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'muted';

type CtxTagStyle = {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly tone: CtxTone;
  readonly iconClass: string;
  readonly chipClass: string;
  readonly calloutClass: string;
  readonly calloutLabelClass: string;
};

type ToneClasses = Pick<
  CtxTagStyle,
  'iconClass' | 'chipClass' | 'calloutClass' | 'calloutLabelClass'
>;

const TONE_CLASSES: Record<CtxTone, ToneClasses> = {
  primary: {
    iconClass: 'text-primary',
    chipClass: 'bg-primary/10 text-primary',
    calloutClass: 'border-primary/20 bg-primary/5',
    calloutLabelClass: 'text-primary',
  },
  success: {
    iconClass: 'text-success',
    chipClass: 'bg-success/10 text-success',
    calloutClass: 'border-success/20 bg-success/5',
    calloutLabelClass: 'text-success',
  },
  warning: {
    iconClass: 'text-warning',
    chipClass: 'bg-warning/10 text-warning',
    calloutClass: 'border-warning/25 bg-warning/5',
    calloutLabelClass: 'text-warning',
  },
  danger: {
    iconClass: 'text-danger',
    chipClass: 'bg-danger/10 text-danger',
    calloutClass: 'border-danger/25 bg-danger/5',
    calloutLabelClass: 'text-danger',
  },
  info: {
    iconClass: 'text-info',
    chipClass: 'bg-info/10 text-info',
    calloutClass: 'border-info/20 bg-info/5',
    calloutLabelClass: 'text-info',
  },
  muted: {
    iconClass: 'text-muted-foreground',
    chipClass: 'bg-muted text-muted-foreground',
    calloutClass: 'border-border-soft bg-muted/40',
    calloutLabelClass: 'text-muted-foreground',
  },
};

type TagSpec = {
  readonly match: RegExp;
  readonly icon: LucideIcon;
  readonly label: string;
  readonly tone: CtxTone;
};

const TAG_SPECS: ReadonlyArray<TagSpec> = [
  { match: /^goal$/i, icon: Target, label: 'goal', tone: 'primary' },
  { match: /^(summary|tl-?dr)$/i, icon: TextQuote, label: 'summary', tone: 'primary' },
  { match: /^(decision|decisions)$/i, icon: CheckCheck, label: 'decision', tone: 'success' },
  {
    match: /^(question|questions|open-?questions)$/i,
    icon: HelpCircle,
    label: 'question',
    tone: 'warning',
  },
  { match: /^(risk|risks|warning)$/i, icon: TriangleAlert, label: 'risk', tone: 'danger' },
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

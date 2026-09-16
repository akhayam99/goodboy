import { Activity, CheckCheck, FileEdit, HelpCircle, Target, type LucideIcon } from 'lucide-react';

type CtxTagStyle = {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly iconClass: string;
  readonly chipClass: string;
  readonly calloutClass: string;
  readonly calloutLabelClass: string;
};

const CTX_DEFAULT: CtxTagStyle = {
  icon: Activity,
  label: '',
  iconClass: 'text-muted-foreground',
  chipClass: 'bg-muted text-muted-foreground',
  calloutClass: 'border-border-soft bg-muted/40',
  calloutLabelClass: 'text-muted-foreground',
};

const CTX_TAG_STYLES: ReadonlyArray<readonly [RegExp, CtxTagStyle]> = [
  [
    /^(ctx-?)?goal$/i,
    {
      icon: Target,
      label: 'goal',
      iconClass: 'text-primary',
      chipClass: 'bg-primary/10 text-primary',
      calloutClass: 'border-primary/20 bg-primary/5',
      calloutLabelClass: 'text-primary',
    },
  ],
  [
    /^(ctx-?)?(decision|decisions)$/i,
    {
      icon: CheckCheck,
      label: 'decision',
      iconClass: 'text-success',
      chipClass: 'bg-success/10 text-success',
      calloutClass: 'border-success/20 bg-success/5',
      calloutLabelClass: 'text-success',
    },
  ],
  [
    /^(ctx-?)?(question|questions|open-?questions)$/i,
    {
      icon: HelpCircle,
      label: 'question',
      iconClass: 'text-warning',
      chipClass: 'bg-warning/10 text-warning',
      calloutClass: 'border-warning/25 bg-warning/5',
      calloutLabelClass: 'text-warning',
    },
  ],
  [
    /^(ctx-?)?(output|last-?output|last-?output-?summary|summary)$/i,
    {
      icon: Activity,
      label: 'output',
      iconClass: 'text-info',
      chipClass: 'bg-info/10 text-info',
      calloutClass: 'border-info/20 bg-info/5',
      calloutLabelClass: 'text-info',
    },
  ],
  [
    /^(ctx-?)?(files?|files-?touched)$/i,
    {
      icon: FileEdit,
      label: 'files',
      iconClass: 'text-info',
      chipClass: 'bg-info/10 text-info',
      calloutClass: 'border-info/20 bg-info/5',
      calloutLabelClass: 'text-info',
    },
  ],
];

type TagParams = {
  readonly tag: string;
};

export const ctxStyleForTag = ({ tag }: TagParams): CtxTagStyle => {
  const stripped = tag.replace(/^ctx-?/i, '');
  for (const [re, style] of CTX_TAG_STYLES) {
    if (re.test(tag) || re.test(stripped)) {
      return style;
    }
  }
  return { ...CTX_DEFAULT, label: stripped || tag };
};

export const ctxTagLabel = ({ tag }: TagParams): string => {
  const style = ctxStyleForTag({ tag });
  return style.label || tag.replace(/^ctx-?/i, '') || tag;
};

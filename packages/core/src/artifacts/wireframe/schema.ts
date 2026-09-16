export const WIREFRAME_SCHEMA_VERSION = 1;

export const WIREFRAME_LIMITS = {
  maxScreens: 12,
  maxNodes: 500,
  maxDepth: 12,
  maxTransitions: 120,
  maxTextLength: 400,
  maxIdLength: 64,
  maxListItems: 40,
  maxTableColumns: 8,
  maxTableRows: 40,
  maxGridColumns: 6,
  maxNavigationItems: 10,
  maxSelectOptions: 20,
  maxMockStateKeys: 20,
} as const;

export const WIREFRAME_NODE_KINDS = [
  'stack',
  'grid',
  'text',
  'button',
  'input',
  'list',
  'table',
  'image',
  'navigation',
] as const;

export type WireframeNodeKind = (typeof WIREFRAME_NODE_KINDS)[number];

export const WIREFRAME_VIEWPORTS = ['mobile', 'tablet', 'desktop'] as const;

export type WireframeViewport = (typeof WIREFRAME_VIEWPORTS)[number];

export const WIREFRAME_TEXT_VARIANTS = ['title', 'subtitle', 'body', 'caption', 'label'] as const;

export type WireframeTextVariant = (typeof WIREFRAME_TEXT_VARIANTS)[number];

export const WIREFRAME_BUTTON_VARIANTS = ['primary', 'secondary', 'ghost', 'danger'] as const;

export type WireframeButtonVariant = (typeof WIREFRAME_BUTTON_VARIANTS)[number];

export const WIREFRAME_INPUT_TYPES = [
  'text',
  'email',
  'password',
  'search',
  'number',
  'textarea',
  'select',
  'checkbox',
] as const;

export type WireframeInputType = (typeof WIREFRAME_INPUT_TYPES)[number];

export const WIREFRAME_IMAGE_RATIOS = ['square', 'wide', 'tall', 'avatar'] as const;

export type WireframeImageRatio = (typeof WIREFRAME_IMAGE_RATIOS)[number];

export const WIREFRAME_NAVIGATION_VARIANTS = ['top', 'side', 'tabs', 'bottom'] as const;

export type WireframeNavigationVariant = (typeof WIREFRAME_NAVIGATION_VARIANTS)[number];

export const WIREFRAME_DIRECTIONS = ['row', 'column'] as const;

export type WireframeDirection = (typeof WIREFRAME_DIRECTIONS)[number];

export const WIREFRAME_ALIGNMENTS = ['start', 'center', 'end', 'stretch'] as const;

export type WireframeAlignment = (typeof WIREFRAME_ALIGNMENTS)[number];

export const WIREFRAME_JUSTIFICATIONS = ['start', 'center', 'end', 'between'] as const;

export type WireframeJustification = (typeof WIREFRAME_JUSTIFICATIONS)[number];

export const WIREFRAME_SPACINGS = ['none', 'sm', 'md', 'lg'] as const;

export type WireframeSpacing = (typeof WIREFRAME_SPACINGS)[number];

export const WIREFRAME_THEME_COLOR_TOKENS = [
  'background',
  'surface',
  'foreground',
  'muted',
  'border',
  'accent',
  'accentForeground',
  'danger',
] as const;

export type WireframeThemeColorToken = (typeof WIREFRAME_THEME_COLOR_TOKENS)[number];

export const WIREFRAME_THEME_FONTS = ['sans', 'serif', 'mono'] as const;

export type WireframeThemeFont = (typeof WIREFRAME_THEME_FONTS)[number];

export const WIREFRAME_THEME_RADII = ['none', 'sm', 'md', 'lg', 'full'] as const;

export type WireframeThemeRadius = (typeof WIREFRAME_THEME_RADII)[number];

export type WireframeTheme = Readonly<{
  name: string;
  font?: WireframeThemeFont;
  radius?: WireframeThemeRadius;
  colors?: Readonly<Partial<Record<WireframeThemeColorToken, string>>>;
  sources?: ReadonlyArray<string>;
}>;

export type WireframeAction =
  | Readonly<{ type: 'navigate'; toScreenId: string }>
  | Readonly<{ type: 'toggle'; stateKey: string }>;

type NodeBase<Kind extends WireframeNodeKind> = Readonly<{
  id: string;
  kind: Kind;
  note?: string;
}>;

export type WireframeStackNode = NodeBase<'stack'> &
  Readonly<{
    direction: WireframeDirection;
    gap?: WireframeSpacing;
    padding?: WireframeSpacing;
    align?: WireframeAlignment;
    justify?: WireframeJustification;
    surface?: boolean;
    children: ReadonlyArray<WireframeNode>;
  }>;

export type WireframeGridNode = NodeBase<'grid'> &
  Readonly<{
    columns: number;
    gap?: WireframeSpacing;
    padding?: WireframeSpacing;
    children: ReadonlyArray<WireframeNode>;
  }>;

export type WireframeTextNode = NodeBase<'text'> &
  Readonly<{
    text: string;
    variant?: WireframeTextVariant;
  }>;

export type WireframeButtonNode = NodeBase<'button'> &
  Readonly<{
    label: string;
    variant?: WireframeButtonVariant;
    action?: WireframeAction;
  }>;

export type WireframeInputNode = NodeBase<'input'> &
  Readonly<{
    inputType: WireframeInputType;
    label?: string;
    placeholder?: string;
    options?: ReadonlyArray<string>;
  }>;

export type WireframeListItem = Readonly<{
  id: string;
  title: string;
  subtitle?: string;
  action?: WireframeAction;
}>;

export type WireframeListNode = NodeBase<'list'> &
  Readonly<{
    items: ReadonlyArray<WireframeListItem>;
  }>;

export type WireframeTableNode = NodeBase<'table'> &
  Readonly<{
    columns: ReadonlyArray<string>;
    rows: ReadonlyArray<ReadonlyArray<string>>;
  }>;

export type WireframeImageNode = NodeBase<'image'> &
  Readonly<{
    alt: string;
    ratio?: WireframeImageRatio;
  }>;

export type WireframeNavigationItem = Readonly<{
  id: string;
  label: string;
  isActive?: boolean;
  action?: WireframeAction;
}>;

export type WireframeNavigationNode = NodeBase<'navigation'> &
  Readonly<{
    variant: WireframeNavigationVariant;
    items: ReadonlyArray<WireframeNavigationItem>;
  }>;

export type WireframeNode =
  | WireframeStackNode
  | WireframeGridNode
  | WireframeTextNode
  | WireframeButtonNode
  | WireframeInputNode
  | WireframeListNode
  | WireframeTableNode
  | WireframeImageNode
  | WireframeNavigationNode;

export type WireframeScreen = Readonly<{
  id: string;
  title: string;
  viewport: WireframeViewport;
  root: WireframeNode;
  note?: string;
}>;

export type WireframeTransition = Readonly<{
  fromNodeId: string;
  toScreenId: string;
  label: string;
}>;

export type WireframeDocument = Readonly<{
  version: number;
  initialScreenId: string;
  theme: WireframeTheme;
  screens: ReadonlyArray<WireframeScreen>;
  transitions: ReadonlyArray<WireframeTransition>;
  mockState?: Readonly<Record<string, boolean>>;
}>;

export type WireframeIssue = Readonly<{
  path: string;
  message: string;
}>;

export const MAX_WIREFRAME_ADJUSTMENTS = 24;

export type WireframeAdjustmentChange = 'moved' | 'clipped' | 'dropped';

export type WireframeAdjustment =
  | Readonly<{
      change: WireframeAdjustmentChange;
      path: string;
      message: string;
      count: number;
    }>
  | Readonly<{ change: 'hidden'; moved: number; clipped: number; dropped: number }>;

export type WireframeValidationResult =
  | Readonly<{
      status: 'valid';
      document: WireframeDocument;
      adjustments: ReadonlyArray<WireframeAdjustment>;
    }>
  | Readonly<{ status: 'invalid'; issues: ReadonlyArray<WireframeIssue> }>;

export const GENERIC_THEME_NAME = 'generic';

import { WIREFRAME_LIMITS, WIREFRAME_VIEWPORTS, type WireframeTheme } from '@goodboy/core';
import type { WireframeFidelity } from '../wireframeFidelity';
import {
  SPACING_PX,
  VIEWPORT_MIN_HEIGHT,
  VIEWPORT_WIDTH,
  wireframePalette,
} from '../wireframePalette';
import staticRules from './wireframeExport.css?raw';

const ALIGN: Readonly<Record<string, string>> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
};

const JUSTIFY: Readonly<Record<string, string>> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
};

const RATIO: Readonly<Record<string, string>> = {
  square: '1 / 1',
  wide: '16 / 9',
  tall: '3 / 4',
  avatar: '1 / 1',
};

type Params = {
  readonly theme: WireframeTheme;
  readonly fidelity: WireframeFidelity;
};

export const wireframeExportCss = ({ theme, fidelity }: Params): string => {
  const palette = wireframePalette({ theme, fidelity });
  const tokens = [
    ':root {',
    `  --wf-page: ${palette.background};`,
    `  --wf-background: ${palette.background};`,
    `  --wf-surface: ${palette.surface};`,
    `  --wf-foreground: ${palette.foreground};`,
    `  --wf-muted: ${palette.muted};`,
    `  --wf-border: ${palette.border};`,
    `  --wf-accent: ${palette.accent};`,
    `  --wf-accent-foreground: ${palette.accentForeground};`,
    `  --wf-danger: ${palette.danger};`,
    `  --wf-placeholder: ${palette.placeholder};`,
    `  --wf-radius: ${palette.radius}px;`,
    `  --wf-font: ${palette.fontFamily};`,
    '}',
  ].join('\n');
  const spacing = Object.entries(SPACING_PX).flatMap(([name, px]) => [
    `.wf-gap-${name} { gap: ${px}px; }`,
    `.wf-pad-${name} { padding: ${px}px; }`,
  ]);
  const align = Object.entries(ALIGN).map(
    ([key, value]) => `.wf-align-${key} { align-items: ${value}; }`,
  );
  const justify = Object.entries(JUSTIFY).map(
    ([key, value]) => `.wf-justify-${key} { justify-content: ${value}; }`,
  );
  const columns = Array.from(
    { length: WIREFRAME_LIMITS.maxGridColumns },
    (_, index) =>
      `.wf-cols-${index + 1} { grid-template-columns: repeat(${index + 1}, minmax(0, 1fr)); }`,
  );
  const ratios = Object.entries(RATIO).map(
    ([key, value]) => `.wf-ratio-${key} { aspect-ratio: ${value}; }`,
  );
  const viewports = WIREFRAME_VIEWPORTS.map(
    (viewport) =>
      `.wf-viewport-${viewport} { max-width: ${VIEWPORT_WIDTH[viewport]}px; min-height: ${VIEWPORT_MIN_HEIGHT[viewport]}px; }`,
  );
  return [
    tokens,
    staticRules.trim(),
    ...spacing,
    ...align,
    ...justify,
    ...columns,
    ...ratios,
    ...viewports,
    '',
  ].join('\n');
};

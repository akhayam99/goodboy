type Params = {
  readonly field: HTMLTextAreaElement;
};

export type CaretLine = {
  readonly top: number;
  readonly bottom: number;
};

const MIRRORED = [
  'boxSizing',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'letterSpacing',
  'lineHeight',
  'textTransform',
  'textIndent',
  'wordSpacing',
  'tabSize',
] as const satisfies ReadonlyArray<keyof CSSStyleDeclaration>;

const FALLBACK_LINE_PX = 20;

export const caretLineOf = ({ field }: Params): CaretLine => {
  const style = getComputedStyle(field);
  const mirror = document.createElement('div');
  for (const name of MIRRORED) {
    mirror.style[name] = style[name];
  }
  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.top = '0';
  mirror.style.left = '-9999px';
  mirror.style.boxSizing = 'border-box';
  mirror.style.width = `${field.clientWidth}px`;
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.overflowWrap = 'break-word';
  mirror.textContent = field.value.slice(0, field.selectionEnd);
  const marker = document.createElement('span');
  marker.textContent = '​';
  mirror.appendChild(marker);
  document.body.appendChild(mirror);
  const top = marker.offsetTop;
  const lineHeight = Number.parseFloat(style.lineHeight);
  const height =
    marker.offsetHeight > 0
      ? marker.offsetHeight
      : Number.isFinite(lineHeight)
        ? lineHeight
        : FALLBACK_LINE_PX;
  mirror.remove();
  return { top, bottom: top + height };
};

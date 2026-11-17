type Params = {
  readonly field: HTMLTextAreaElement;
};

export type CaretLine = {
  readonly top: number;
  readonly bottom: number;
};

const MIRRORED = [
  'box-sizing',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'letter-spacing',
  'line-height',
  'text-transform',
  'text-indent',
  'word-spacing',
  'tab-size',
] as const;

const FALLBACK_LINE_PX = 20;

export const caretLineOf = ({ field }: Params): CaretLine => {
  const style = getComputedStyle(field);
  const mirror = document.createElement('div');
  for (const name of MIRRORED) {
    mirror.style.setProperty(name, style.getPropertyValue(name));
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

// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Textarea } from './Textarea';

const LINE_PX = 20;
const PAD_PX = 8;
const MAX_PX = 6 * LINE_PX + 2 * PAD_PX;
const SCROLLER_TOP_PX = 100;
const SCROLLER_VIEW_PX = 200;
const FIELD_OFFSET_PX = 300;

const TEN_LINES = Array.from({ length: 10 }, (_, index) => `line ${index + 1}`).join('\n');

type ScrollBox = {
  readonly element: HTMLElement;
  top: number;
};

type GeometryParams = {
  readonly scrollerTop: number;
  readonly outerTop: number;
};

type Geometry = {
  readonly field: HTMLTextAreaElement;
  readonly scroller: ScrollBox;
  readonly outer: ScrollBox;
};

type TypeParams = {
  readonly field: HTMLTextAreaElement;
  readonly text: string;
  readonly caret: number;
};

type TextParams = {
  readonly text: string;
};

type FieldParams = {
  readonly field: HTMLTextAreaElement;
};

type RenderParams = {
  readonly value?: string;
  readonly defaultValue?: string;
};

type SupportParams = {
  readonly isSupported: boolean;
};

type ScrollTopParams = {
  readonly element: HTMLElement;
  readonly box: ScrollBox;
};

const linesOf = ({ text }: TextParams): number => text.split('\n').length;

const fieldHeightOf = ({ field }: FieldParams): number =>
  linesOf({ text: field.value }) * LINE_PX + 2 * PAD_PX;

const caretLineTopOf = ({ text }: TextParams): number => PAD_PX + (linesOf({ text }) - 1) * LINE_PX;

const bindScrollTop = ({ element, box }: ScrollTopParams): void => {
  Object.defineProperty(element, 'scrollTop', {
    configurable: true,
    get: () => box.top,
    set: (next: number) => {
      box.top = next;
    },
  });
};

const geometry = ({ scrollerTop, outerTop }: GeometryParams): Geometry => {
  const field = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Answer' });
  const scrollerElement = screen.getByTestId('scroller');
  const outerElement = screen.getByTestId('outer');
  const scroller: ScrollBox = { element: scrollerElement, top: scrollerTop };
  const outer: ScrollBox = { element: outerElement, top: outerTop };
  const own: ScrollBox = { element: field, top: 0 };
  bindScrollTop({ element: scrollerElement, box: scroller });
  bindScrollTop({ element: outerElement, box: outer });
  bindScrollTop({ element: field, box: own });
  Object.defineProperties(scrollerElement, {
    clientHeight: { configurable: true, get: () => SCROLLER_VIEW_PX },
    scrollHeight: { configurable: true, get: () => 800 },
    getBoundingClientRect: {
      configurable: true,
      value: () => DOMRect.fromRect({ y: SCROLLER_TOP_PX, height: SCROLLER_VIEW_PX }),
    },
  });
  Object.defineProperties(outerElement, {
    clientHeight: { configurable: true, get: () => 400 },
    scrollHeight: { configurable: true, get: () => 1200 },
  });
  Object.defineProperties(field, {
    clientHeight: {
      configurable: true,
      get: () => Math.min(MAX_PX, fieldHeightOf({ field })),
    },
    scrollHeight: { configurable: true, get: () => fieldHeightOf({ field }) },
    clientWidth: { configurable: true, get: () => 320 },
    getBoundingClientRect: {
      configurable: true,
      value: () =>
        DOMRect.fromRect({
          y: SCROLLER_TOP_PX + FIELD_OFFSET_PX - scroller.top,
          height: Math.min(MAX_PX, fieldHeightOf({ field })),
        }),
    },
  });
  return { field, scroller, outer };
};

const typeInto = ({ field, text, caret }: TypeParams): void => {
  const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  setValue?.call(field, text);
  field.setSelectionRange(caret, caret);
  fireEvent.input(field);
};

const fieldTree = ({ value, defaultValue }: RenderParams) => (
  <div data-testid="outer" style={{ overflowY: 'auto' }}>
    <div data-testid="scroller" style={{ overflowY: 'auto' }}>
      <Textarea
        aria-label="Answer"
        autoGrow
        minRows={2}
        maxRows={6}
        onChange={() => undefined}
        {...(value === undefined ? {} : { value })}
        {...(defaultValue === undefined ? {} : { defaultValue })}
      />
    </div>
  </div>
);

const supportsContentSizing = ({ isSupported }: SupportParams): void => {
  vi.stubGlobal('CSS', { supports: () => isSupported });
};

beforeEach(() => {
  Object.defineProperties(HTMLSpanElement.prototype, {
    offsetTop: {
      configurable: true,
      get(this: HTMLSpanElement) {
        return caretLineTopOf({ text: this.parentElement?.textContent ?? '' });
      },
    },
    offsetHeight: { configurable: true, get: () => LINE_PX },
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(HTMLSpanElement.prototype, 'offsetTop');
  Reflect.deleteProperty(HTMLSpanElement.prototype, 'offsetHeight');
});

describe('a growing Textarea', () => {
  it('grows by content in CSS up to the max height and never collapses to measure', () => {
    supportsContentSizing({ isSupported: true });
    render(fieldTree({ defaultValue: '' }));
    const { field } = geometry({ scrollerTop: 0, outerTop: 0 });

    typeInto({ field, text: TEN_LINES, caret: TEN_LINES.length });

    expect(field.style.maxHeight).toBe(`${MAX_PX}px`);
    expect(field.style.minHeight).toBe(`${2 * LINE_PX + 2 * PAD_PX}px`);
    expect(field.style.height).toBe('');
  });

  it('keeps the caret line inside the field once the text passes the max height', () => {
    supportsContentSizing({ isSupported: true });
    render(fieldTree({ defaultValue: '' }));
    const { field } = geometry({ scrollerTop: FIELD_OFFSET_PX, outerTop: 0 });

    typeInto({ field, text: TEN_LINES, caret: TEN_LINES.length });

    const caretTop = caretLineTopOf({ text: TEN_LINES });
    expect(field.scrollTop).toBeGreaterThan(0);
    expect(caretTop + LINE_PX).toBeLessThanOrEqual(field.scrollTop + field.clientHeight);
    expect(caretTop).toBeGreaterThanOrEqual(field.scrollTop);
  });

  it('follows the caret up when typing on the first line of a scrolled field', () => {
    supportsContentSizing({ isSupported: true });
    render(fieldTree({ defaultValue: '' }));
    const { field } = geometry({ scrollerTop: FIELD_OFFSET_PX, outerTop: 0 });
    typeInto({ field, text: TEN_LINES, caret: TEN_LINES.length });

    typeInto({ field, text: `x${TEN_LINES}`, caret: 1 });

    expect(field.scrollTop).toBeLessThanOrEqual(PAD_PX);
  });

  it('after a scroll away, typing brings back the nearest scroller only', () => {
    supportsContentSizing({ isSupported: true });
    render(fieldTree({ defaultValue: '' }));
    const { field, scroller, outer } = geometry({ scrollerTop: 0, outerTop: 50 });

    typeInto({ field, text: TEN_LINES, caret: TEN_LINES.length });

    const lineTop =
      field.getBoundingClientRect().top +
      caretLineTopOf({ text: TEN_LINES }) -
      field.scrollTop -
      SCROLLER_TOP_PX;
    expect(scroller.top).toBeGreaterThan(0);
    expect(lineTop).toBeGreaterThanOrEqual(0);
    expect(lineTop + LINE_PX).toBeLessThanOrEqual(SCROLLER_VIEW_PX - 24);
    expect(outer.top).toBe(50);
    expect(document.documentElement.scrollTop).toBe(0);
  });

  it('does not move anything when the text changes without typing', () => {
    supportsContentSizing({ isSupported: true });
    const { rerender } = render(fieldTree({ value: 'one line' }));
    const { field, scroller, outer } = geometry({ scrollerTop: 0, outerTop: 50 });

    rerender(fieldTree({ value: TEN_LINES }));

    expect(field.scrollTop).toBe(0);
    expect(scroller.top).toBe(0);
    expect(outer.top).toBe(50);
  });

  it('without content sizing, measuring keeps every scroller where it was', () => {
    supportsContentSizing({ isSupported: false });
    render(fieldTree({ defaultValue: '' }));
    const { field, scroller } = geometry({ scrollerTop: FIELD_OFFSET_PX, outerTop: 0 });
    Object.defineProperty(field, 'scrollHeight', {
      configurable: true,
      get: () => {
        if (field.style.height === 'auto') {
          scroller.top = Math.min(scroller.top, 120);
        }
        return fieldHeightOf({ field });
      },
    });

    typeInto({ field, text: TEN_LINES, caret: TEN_LINES.length });

    expect(field.style.height).toBe(`${MAX_PX}px`);
    expect(field.style.overflowY).toBe('auto');
    expect(scroller.top).toBe(FIELD_OFFSET_PX);
  });
});

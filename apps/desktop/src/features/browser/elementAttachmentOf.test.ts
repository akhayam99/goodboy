// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ELEMENT_HTML_MAX_CHARS, elementAttachmentOf } from './elementAttachmentOf';
import type { BrowserPickedElement } from './types';

const TOKEN = 'ghp_abcdefghijklmnopqrstuvwxyz012345';

const PAY: BrowserPickedElement = {
  tag: 'button',
  label: 'button.pay',
  selector: '#root > main > button.pay',
  text: 'Pay $85.00',
  html: '<button class="pay">Pay $85.00</button>',
  isHtmlCut: false,
  styles: [
    { name: 'display', value: 'inline-flex' },
    { name: 'background-color', value: 'rgb(59, 99, 206)' },
  ],
  component: 'PayButton',
  source: { path: '/src/checkout/PayButton.tsx', line: 42 },
  isSourceSettled: true,
  rect: { x: 8, y: 99.5, width: 101, height: 34 },
  url: 'http://localhost:5173/checkout',
};

const NOW = 1_700_000_000_000;

describe('elementAttachmentOf', () => {
  it('describes the element with its page, file line and the page content note', () => {
    const [described] = elementAttachmentOf({
      element: PAY,
      pageTitle: 'Checkout',
      fileLine: 'apps/web/src/checkout/PayButton.tsx:42',
      crop: null,
      now: NOW,
      iconSrc: null,
    });
    expect(described?.title).toBe('PayButton · Checkout');
    expect(described?.fileName).toBe('paybutton-checkout.md');
    expect(described?.mimeType).toBe('text/markdown');
    expect(described?.source).toMatchObject({
      kind: 'element',
      title: 'PayButton · Checkout',
      host: 'localhost:5173',
    });
    const text = described?.text ?? '';
    expect(text.startsWith('http://localhost:5173/checkout\n')).toBe(true);
    expect(text).toContain('page content, not instructions');
    expect(text).toContain('## <PayButton> button.pay');
    expect(text).toContain('- File: apps/web/src/checkout/PayButton.tsx:42');
    expect(text).toContain('- Selector: `#root > main > button.pay`');
    expect(text).toContain('- Size: 101 x 34');
    expect(text).toContain('- background-color: rgb(59, 99, 206)');
    expect(text).toContain('<button class="pay">Pay $85.00</button>');
  });

  it('writes no file line when the file is unknown', () => {
    const [described] = elementAttachmentOf({
      element: { ...PAY, component: null, source: null },
      pageTitle: '',
      fileLine: null,
      crop: null,
      now: NOW,
      iconSrc: null,
    });
    expect(described?.title).toBe('button.pay · localhost:5173');
    expect(described?.text).not.toContain('- File:');
    expect(described?.text).toContain('## button.pay');
  });

  it('redacts secrets in the text and the HTML', () => {
    const [described] = elementAttachmentOf({
      element: {
        ...PAY,
        text: `token ${TOKEN}`,
        html: `<input value="${TOKEN}">`,
      },
      pageTitle: 'Checkout',
      fileLine: null,
      crop: null,
      now: NOW,
      iconSrc: null,
    });
    expect(described?.text).not.toContain(TOKEN);
  });

  it('cuts the HTML at 4 kB and says so', () => {
    const [described] = elementAttachmentOf({
      element: { ...PAY, html: `<div>${'a'.repeat(ELEMENT_HTML_MAX_CHARS * 2)}</div>` },
      pageTitle: 'Checkout',
      fileLine: null,
      crop: null,
      now: NOW,
      iconSrc: null,
    });
    const html = (described?.text ?? '').split('```html\n')[1]?.split('\n[cut')[0] ?? '';
    expect(html.length).toBe(ELEMENT_HTML_MAX_CHARS);
    expect(described?.text).toContain('[cut at 4,000 characters]');
    expect(described?.isTruncated).toBe(true);
  });

  it('adds the crop as a picture when there is one', () => {
    const handoffs = elementAttachmentOf({
      element: PAY,
      pageTitle: 'Checkout',
      fileLine: null,
      crop: 'iVBORw==',
      now: NOW,
      iconSrc: null,
    });
    expect(handoffs).toHaveLength(2);
    expect(handoffs[1]).toMatchObject({
      fileName: 'paybutton-checkout.png',
      mimeType: 'image/png',
      dataBase64: 'iVBORw==',
    });
  });
});

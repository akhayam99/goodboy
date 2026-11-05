import { STAGE_GRADIENT_TOKEN } from '../constants.mjs';

const HERO_SETTLE_MS = 5000;
const INTER_PROBE = '500 64px Inter';
const OVERLAP_TOLERANCE_PX = 1;

export const PAGE_PROBE = `(async () => {
  await document.fonts.ready;
  const root = document.documentElement;
  const text = [...document.querySelectorAll('body, [role=tabpanel]')]
    .map((node) => node.textContent ?? '')
    .join('\\n');
  const middot = /[^\\s\\u00b7]+[ \\u00a0]*\\u00b7[ \\u00a0]*[^\\s\\u00b7]+[ \\u00a0]*\\u00b7[ \\u00a0]*[^\\s\\u00b7]+/;
  const isShadow = (value) => {
    if (value === 'none') {
      return false;
    }
    return value.split(/,(?![^(]*\\))/).some((layer) => {
      const lengths = layer.replace(/[a-z]+\\([^)]*\\)|#[0-9a-f]+/gi, '').match(/-?[\\d.]+px/g) ?? [];
      const [x = '0px', y = '0px', blur = '0px'] = lengths;
      return parseFloat(x) !== 0 || parseFloat(y) !== 0 || parseFloat(blur) !== 0;
    });
  };
  const shadowed = [...document.querySelectorAll('.mockStage, .mockStage *')]
    .filter((node) => !node.hasAttribute('data-shadow-exception'))
    .filter((node) => isShadow(getComputedStyle(node).boxShadow) || getComputedStyle(node).filter.includes('drop-shadow'))
    .map((node) => String(node.className || node.tagName));
  const brokenImages = [...document.querySelectorAll('img')]
    .filter((image) => image.getClientRects().length > 0)
    .filter((image) => !(image.complete && image.naturalWidth > 0))
    .map((image) => (image.getAttribute('src') ?? '').split('/').pop());
  const heroMock = document.querySelector('[data-hero-mock]');
  const heroRise = heroMock === null ? null : heroMock.closest('.rise') ?? heroMock;
  if (heroRise !== null) {
    await Promise.race([
      Promise.all(heroRise.getAnimations().map((animation) => animation.finished.catch(() => null))),
      new Promise((done) => setTimeout(done, ${HERO_SETTLE_MS})),
    ]);
  }
  const banner = document.querySelector('#iubenda-cs-banner .iubenda-cs-content');
  const h1 = document.querySelector('h1');
  const periods = [...document.querySelectorAll('h1, h2, h3')]
    .map((node) => node.textContent.trim())
    .filter((text) => text.endsWith('.'));
  const blocks = [...document.querySelectorAll('body > #root > nav, main > *, body > #root > footer')]
    .map((node) => ({ node, box: node.getBoundingClientRect() }))
    .filter(({ box }) => box.height > 0);
  const name = (node) => node.id || node.getAttribute('aria-label') || String(node.className || node.tagName).split(' ')[0];
  const collisions = blocks.slice(1).flatMap(({ node, box }, index) => {
    const previous = blocks[index];
    if (previous.node.tagName === 'NAV') {
      return [];
    }
    const gap = box.top - previous.box.bottom;
    return gap < -${OVERLAP_TOLERANCE_PX} ? [name(previous.node) + ' runs ' + Math.round(-gap) + ' px into ' + name(node)] : [];
  });
  const spills = blocks
    .filter(({ node }) => node.tagName !== 'NAV')
    .flatMap(({ node, box }) => {
      const deepest = Math.max(
        ...[...node.querySelectorAll('a, button, p, h1, h2, h3, img, li, code, summary')]
          .map((child) => {
            let bottom = child.getBoundingClientRect().height > 0 ? child.getBoundingClientRect().bottom : -Infinity;
            for (let parent = child.parentElement; parent !== null && parent !== node; parent = parent.parentElement) {
              if (getComputedStyle(parent).overflowY !== 'visible') {
                bottom = Math.min(bottom, parent.getBoundingClientRect().bottom);
              }
            }
            return bottom;
          }),
        box.top,
      );
      return deepest > box.bottom + ${OVERLAP_TOLERANCE_PX} ? [name(node) + ' content spills ' + Math.round(deepest - box.bottom) + ' px below it'] : [];
    });
  const gradientToken = (() => {
    const tokenProbe = document.createElement('span');
    tokenProbe.style.backgroundImage = 'var(${STAGE_GRADIENT_TOKEN})';
    document.body.appendChild(tokenProbe);
    const value = getComputedStyle(tokenProbe).backgroundImage;
    tokenProbe.remove();
    return value;
  })();
  const paintedGradients = [...document.querySelectorAll('body *')].flatMap((node) =>
    [null, '::before', '::after'].flatMap((pseudo) => {
      const style = getComputedStyle(node, pseudo);
      const isRunningRing = node.matches('.gkNodeSpin') && pseudo === '::before';
      return /gradient\\(/.test(style.backgroundImage) && style.backgroundImage !== gradientToken && !isRunningRing
        ? [String(node.className || node.tagName) + (pseudo ?? '')]
        : [];
    }),
  );
  const boardRows = [...document.querySelectorAll('.brdBoard')].flatMap((board) => {
    const columns = [...board.querySelectorAll('.brdCol')].filter((column) => column.getBoundingClientRect().height > 0);
    const bands = new Map();
    columns.forEach((column) => {
      const band = Math.round(column.getBoundingClientRect().top);
      bands.set(band, [...(bands.get(band) ?? []), column]);
    });
    return [...bands.values()].flatMap((band) => {
      const rows = Math.max(...band.map((column) => column.querySelectorAll('.brdCard').length));
      return Array.from({ length: rows }, (_, row) => {
        const heights = band
          .map((column) => column.querySelectorAll('.brdCard')[row])
          .filter((card) => card !== undefined)
          .map((card) => card.getBoundingClientRect().height);
        return { row, spread: Math.max(...heights) - Math.min(...heights), heights: heights.map((height) => Math.round(height * 10) / 10) };
      });
    });
  });
  const isVisible = (node) => {
    const box = node.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && getComputedStyle(node).visibility !== 'hidden';
  };
  const overlaps = (a, b) => !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
  return {
    isCoarse: matchMedia('(hover: none) and (pointer: coarse)').matches,
    downloads: [...document.querySelectorAll('[data-download]')].filter(isVisible).length,
    downloadHrefs: [...document.querySelectorAll('[data-download]')].map((node) => node.href),
    stars: [...document.querySelectorAll('[data-star]')].filter(isVisible).length,
    isInter: document.fonts.check(${JSON.stringify(INTER_PROBE)}),
    scrollWidth: root.scrollWidth,
    clientWidth: root.clientWidth,
    height: root.scrollHeight,
    hasEmDash: text.includes('\\u2014'),
    middot: (text.match(middot) ?? [null])[0],
    shadowed,
    paintedGradients,
    boardRows,
    hasBoard: [...document.querySelectorAll('.brdBoard')].some((board) => board.getBoundingClientRect().height > 0),
    tablists: [...document.querySelectorAll('[role=tablist]')].map((tablist) => ({
      selected: [...tablist.querySelectorAll('[role=tab][aria-selected=true]')].length,
      invalidControls: [...tablist.querySelectorAll('[role=tab]')]
        .filter((tab) => document.getElementById(tab.getAttribute('aria-controls') ?? '') === null)
        .length,
    })),
    hasMockStage: document.querySelector('.mockStage') !== null,
    brokenImages,
    periods,
    collisions,
    spills,
    heroOpacity: heroRise === null ? null : Number(getComputedStyle(heroRise).opacity),
    bannerCoversH1: banner !== null && h1 !== null && overlaps(banner.getBoundingClientRect(), h1.getBoundingClientRect()),
    eyebrows: [...document.querySelectorAll('.eyebrow')].map((node) => ({
      text: node.textContent.trim(),
      group: node.getAttribute('data-group'),
    })),
    brandPaths: [...document.querySelectorAll('svg[data-brand] path')].map((node) => ({
      brand: node.closest('svg').getAttribute('data-brand'),
      d: node.getAttribute('d'),
    })),
    brandInkColors: (() => {
      const inkProbe = document.createElement('span');
      inkProbe.style.color = 'var(--brand-ink)';
      inkProbe.style.position = 'absolute';
      inkProbe.style.opacity = '0';
      document.body.appendChild(inkProbe);
      const inkColor = getComputedStyle(inkProbe).color;
      inkProbe.remove();
      return [...document.querySelectorAll('.provider svg[data-brand]')]
        .filter((node) => node.getAttribute('fill') === 'currentColor')
        .map((node) => ({
          brand: node.getAttribute('data-brand'),
          color: getComputedStyle(node).color,
          ink: inkColor,
        }));
    })(),
  };
})()`;

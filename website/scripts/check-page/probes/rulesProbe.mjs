import {
  FEATURE_DOCS_URL,
  FEATURE_GUIDE_URL,
  MAX_SENTENCE_WORDS,
  SITE_DOCS_PREFIX,
} from '../constants.mjs';
import { SHOWN_HELPER } from './shownHelper.mjs';

const EDGE_TOLERANCE_PX = 1;
const MIN_ROW_TITLE_PX = 120;
const REPEAT_IGNORE = ['goodboy', 'task', 'tasks', 'your', 'with', 'that', 'this', 'from'];
const ROW_PARTS = [
  '.gkOrdinal',
  '.gkRowKind',
  '.gkRowTitle',
  '.gkAnswering',
  '.gkStateLine',
  '.gkRouting',
  '.gkMetaTime',
  '.gkMetaCost',
  '.gkMetaCostRange',
  '.gkActionColumn',
];

export const buildRulesProbe = ({ clusterIds }) => `(() => {
  ${SHOWN_HELPER}
  const clusterIds = ${JSON.stringify(clusterIds)};
  const ignored = ${JSON.stringify(REPEAT_IGNORE)};
  const sentences = (text) => text.replace(/\\s+/g, ' ').trim().split(/(?<=[.!?])\\s+/).filter(Boolean);
  const wordCount = (sentence) => sentence.split(' ').filter(Boolean).length;
  const wordsOf = (text) => new Set((text.toLowerCase().match(/[a-z]{4,}/g) ?? []).filter((word) => !ignored.includes(word)));
  const isSvgSource = (image) => {
    const source = image.getAttribute('src') ?? '';
    return source.startsWith('data:image/svg') || source.split(/[?#]/)[0].endsWith('.svg');
  };
  const shown = (selector) => [...document.querySelectorAll(selector)].filter(isShown);
  const overlaps = (a, b, tolerance) => !(a.right <= b.left + tolerance || a.left >= b.right - tolerance || a.bottom <= b.top + tolerance || a.top >= b.bottom - tolerance);
  const sections = shown('main > section');
  const toned = shown('main section[data-tone]');
  const heroMock = document.querySelector('[data-hero-mock]');
  const heroBox = heroMock === null ? null : heroMock.getBoundingClientRect();
  const worksWith = document.querySelector('[data-works-with]');
  const worksBox = worksWith === null ? null : worksWith.getBoundingClientRect();
  const copyRepeats = shown('.eyebrow').flatMap((eyebrow) => {
    const scope = eyebrow.closest('.statement, section');
    const heading = scope === null ? null : scope.querySelector('h1, h2');
    if (heading === null) {
      return [];
    }
    const lead = scope.querySelector('.lead');
    const parts = [
      ['eyebrow', eyebrow.textContent],
      ['heading', heading.textContent],
      ['lead', lead === null ? '' : sentences(lead.textContent)[0] ?? ''],
    ].map(([part, text]) => [part, wordsOf(text)]);
    return parts.flatMap(([first, firstWords], index) =>
      parts.slice(index + 1).flatMap(([second, secondWords]) =>
        [...firstWords].filter((word) => secondWords.has(word)).map((word) => '"' + word + '" repeats between the ' + first + ' and the ' + second + ' of "' + eyebrow.textContent.trim() + '"'),
      ),
    );
  });
  return {
    ids: [...document.querySelectorAll('[id]')].map((node) => node.id),
    sectionHeights: sections.map((node) => ({ name: describe(node), height: Math.round(node.getBoundingClientRect().height) })),
    clusterHeights: shown('main section[id]')
      .filter((node) => clusterIds.includes(node.id))
      .map((node) => ({ name: node.id, height: Math.round(node.getBoundingClientRect().height) })),
    rasters: [...document.querySelectorAll('main img, main picture')]
      .filter((node) => !node.hasAttribute('data-hero-shot'))
      .filter((node) => node.tagName === 'PICTURE' || !isSvgSource(node))
      .map((node) => describe(node) + ' ' + (node.getAttribute('src') ?? '')),
    heroMock: heroBox === null ? null : {
      top: heroBox.top + window.scrollY,
      bottom: heroBox.bottom + window.scrollY,
    },
    worksWith: worksBox === null ? null : {
      top: worksBox.top + window.scrollY,
      bottom: worksBox.bottom + window.scrollY,
    },
    crowded: toned
      .map((node) => ({ name: describe(node), count: shown('.eyebrow').filter((eyebrow) => node.contains(eyebrow)).length }))
      .filter((entry) => entry.count > 1)
      .map((entry) => entry.name + ' shows ' + entry.count + ' eyebrows'),
    sameTone: toned
      .filter((node) => {
        const previous = node.previousElementSibling;
        return previous !== null && previous.matches('section[data-tone]') && isShown(previous) && previous.dataset.tone === node.dataset.tone;
      })
      .map((node) => describe(node.previousElementSibling) + ' and ' + describe(node) + ' share the tone ' + node.dataset.tone),
    headingEdges: sections.flatMap((section) => {
      const shell = section.querySelector('.shell');
      if (shell === null) {
        return [describe(section) + ' has no .shell'];
      }
      const heading = [...section.querySelectorAll('h1, h2')].find(isShown);
      if (heading === undefined || getComputedStyle(heading).textAlign === 'center') {
        return [];
      }
      const edge = shell.getBoundingClientRect().left + parseFloat(getComputedStyle(shell).paddingLeft);
      const left = heading.getBoundingClientRect().left;
      return Math.abs(left - edge) > ${EDGE_TOLERANCE_PX}
        ? [describe(section) + ' heading starts at ' + left.toFixed(1) + ', the shell edge is ' + edge.toFixed(1)]
        : [];
    }),
    cardEdges: shown('.cardRowItem').flatMap((item) => {
      const left = item.getBoundingClientRect().left;
      return ['.cardRowTitle', '.cardRowCaption'].flatMap((selector) => {
        const part = item.querySelector(selector);
        if (part === null) {
          return [describe(item) + ' has no ' + selector];
        }
        const partLeft = part.getBoundingClientRect().left;
        return Math.abs(partLeft - left) > ${EDGE_TOLERANCE_PX}
          ? [selector + ' starts at ' + partLeft.toFixed(1) + ', its card starts at ' + left.toFixed(1)]
          : [];
      });
    }),
    alsoLines: shown('.ftAlso').map((node) => ({
      name: node.textContent.slice(0, 24),
      lines: Math.round(node.getBoundingClientRect().height / parseFloat(getComputedStyle(node).lineHeight)),
    })),
    rowCollisions: shown('.gkRunAppRow').flatMap((row) => {
      const parts = ${JSON.stringify(ROW_PARTS)}
        .flatMap((selector) => [...row.querySelectorAll(selector)].map((node) => ({ selector, box: node.getBoundingClientRect(), natural: node.scrollWidth })))
        .filter(({ box }) => box.width > 4 && box.height > 4);
      const rowBox = row.getBoundingClientRect();
      const problems = parts.flatMap((part, index) =>
        parts.slice(index + 1)
          .filter((other) => overlaps(part.box, other.box, 1))
          .map((other) => part.selector + ' overlaps ' + other.selector),
      );
      const title = parts.find((part) => part.selector === '.gkRowTitle');
      if (title !== undefined && row.closest('.gkRunStacked') === null && title.box.width < Math.min(${MIN_ROW_TITLE_PX}, title.natural) - 1) {
        problems.push('title is ' + Math.round(title.box.width) + ' px wide in a ' + Math.round(rowBox.width) + ' px row');
      }
      parts
        .filter(({ box }) => box.right > rowBox.right + 1)
        .forEach((part) => problems.push(part.selector + ' leaves the row'));
      return problems.map((problem) => problem + ' at row ' + Math.round(rowBox.top + window.scrollY));
    }),
    seeMoreLinks: [...document.querySelectorAll('[data-see-more]')].map((node) => node.getAttribute('href')),
    guideLinks: [...document.querySelectorAll('a[href]')]
      .filter((node) => node.getAttribute('href').startsWith(${JSON.stringify(FEATURE_GUIDE_URL)}) || node.getAttribute('href').startsWith(${JSON.stringify(FEATURE_DOCS_URL)}) || node.getAttribute('href').startsWith(${JSON.stringify(SITE_DOCS_PREFIX)}))
      .map((node) => ({
        href: node.getAttribute('href'),
        isAllowed: node.classList.contains('refLink') || node.closest('footer') !== null,
      })),
    longSentences: [...document.querySelectorAll('.lead, .cardRowCaption, .tourCopy')].flatMap((node) =>
      sentences(node.textContent)
        .filter((sentence) => wordCount(sentence) > ${MAX_SENTENCE_WORDS})
        .map((sentence) => wordCount(sentence) + ' words in ' + describe(node) + ': "' + sentence.slice(0, 48) + '"'),
    ),
    copyRepeats,
  };
})()`;

import { spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const WEBSITE_DIRECTORY = resolve(SCRIPT_DIRECTORY, '..');
const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DEFAULT_URLS = [
  'http://localhost:1499/',
  'http://localhost:1499/features',
  'http://localhost:1499/docs',
  'http://localhost:1499/docs/providers',
  'http://localhost:1499/changelog',
  'http://localhost:1499/404',
];
const MARKETING_PAGES = ['home', 'features'];
const BLOCKED_URLS = ['*googletagmanager.com*', '*google-analytics.com*'];
const SETTLE_MS = 1200;
const SCROLL_STEP_PX = 600;
const SCROLL_PAUSE_MS = 60;
const TIMEOUT_MS = 480000;
const HERO_MOCK_VISIBLE_PX = 380;
const HERO_FIRST_SCREEN_PX = 900;
const INTER_PROBE = '500 64px Inter';
const REPO_BLOB_PREFIX = 'https://github.com/akhayam99/goodboy/blob/main/';
const FEATURE_GUIDE_URL = `${REPO_BLOB_PREFIX}FEATURES.md`;
const FEATURE_DOCS_URL = `${REPO_BLOB_PREFIX}docs/features/`;
const FEATURE_DOCS_DIRECTORY = 'docs/features';
const SITE_DOCS_PREFIX = '/docs/';

const siteDocTarget = ({ href }) => {
  const [area, anchor] = href.slice(SITE_DOCS_PREFIX.length).split('#');
  return [`${FEATURE_DOCS_DIRECTORY}/${area}.md`, anchor];
};
const SOURCE_DIRECTORY = resolve(WEBSITE_DIRECTORY, 'src');
const STAGE_GRADIENT_TOKEN = '--g-stage-gradient';
const BOARD_ROW_TOLERANCE_PX = 1;
const FEATURES_DATA_PATH = resolve(WEBSITE_DIRECTORY, 'src/pages/features/features.data.json');
const EDGE_TOLERANCE_PX = 1;
const OVERLAP_TOLERANCE_PX = 1;
const MAX_SENTENCE_WORDS = 20;
const MAX_ALSO_LINES = 2;
const MIN_ROW_TITLE_PX = 120;
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
const MIN_TOUCH_FONT_PX = 13;
const MIN_TOUCH_TARGET_PX = 44;
const REPEAT_IGNORE = ['goodboy', 'task', 'tasks', 'your', 'with', 'that', 'this', 'from'];
const PAGES_WITH_DOWNLOAD = ['home'];
const DOWNLOAD_PREFIX = 'https://github.com/akhayam99/goodboy/releases/download/';
const PAGE_BUDGETS = {
  home: { heightByViewport: { desktop: 5000, phone: 6000 }, sectionMaxPx: 1100 },
  features: {
    heightByViewport: { desktop: 8400, phone: 11500 },
    clusterMaxByViewport: { desktop: 900, phone: 1300 },
  },
};

const VIEWPORTS = [
  {
    name: 'desktop',
    width: 1440,
    height: 900,
    isMobile: false,
    isDesktop: true,
    isFirstScreen: true,
  },
  { name: 'laptop', width: 1024, height: 768, isMobile: false },
  { name: 'tablet', width: 768, height: 1024, isMobile: false },
  { name: 'narrow', width: 660, height: 900, isMobile: false },
  { name: 'phone', width: 390, height: 844, isMobile: true, isTouch: true, isFirstScreen: true },
];
const THEMES = ['dark', 'light'];
const PAGE_EYEBROWS = ['Free desktop ADE, built in public', 'Install', 'All features'];

const parseArgs = ({ argv }) => {
  const shotsIndex = argv.indexOf('--shots');
  const shots = shotsIndex === -1 ? null : resolve(argv[shotsIndex + 1]);
  const positional = argv.filter(
    (value, index) => !value.startsWith('--') && argv[index - 1] !== '--shots',
  );
  return {
    urls: positional.length > 0 ? positional : DEFAULT_URLS,
    shots,
    isVerifyingIcons: argv.includes('--verify-icons'),
  };
};

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

const launchChrome = async () => {
  const port = 9400 + Math.floor(Math.random() * 400);
  const profile = mkdtempSync(join(tmpdir(), 'goodboy-check-page-'));
  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      ...(process.env.CI === undefined ? [] : ['--no-sandbox']),
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  const close = () => {
    chrome.kill('SIGKILL');
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    } catch {
      console.warn(`check-page: could not remove ${profile}`);
    }
  };
  const readTargets = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      return await response.json();
    } catch {
      return null;
    }
  };
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const targets = await readTargets();
    const page = targets?.find((target) => target.type === 'page');
    if (page !== undefined) {
      return { close, socketUrl: page.webSocketDebuggerUrl };
    }
    await sleep(100);
  }
  close();
  throw new Error('Chrome did not open a debugging port');
};

const connect = async ({ socketUrl }) => {
  const socket = new WebSocket(socketUrl);
  await new Promise((done) => socket.addEventListener('open', done));
  const pending = new Map();
  let nextId = 0;
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id === undefined || !pending.has(message.id)) {
      return;
    }
    pending.get(message.id)(message);
    pending.delete(message.id);
  });
  const send = (method, params = {}) =>
    new Promise((done) => {
      nextId += 1;
      pending.set(nextId, done);
      socket.send(JSON.stringify({ id: nextId, method, params }));
    });
  const evaluate = async (expression) => {
    const response = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (response.result?.exceptionDetails !== undefined) {
      throw new Error(response.result.exceptionDetails.exception?.description ?? expression);
    }
    return response.result?.result?.value;
  };
  return { send, evaluate, close: () => socket.close() };
};

const readGroups = ({ file }) =>
  readFileSync(resolve(WEBSITE_DIRECTORY, '..', file), 'utf8')
    .split('\n')
    .flatMap((line) => {
      if (line.startsWith('## ')) {
        return [line.slice(3).trim()];
      }
      const summary = line.match(/^<summary><h2>(.*)<\/h2><\/summary>/);
      return summary === null ? [] : [summary[1].trim()];
    });

const readClusters = () => JSON.parse(readFileSync(FEATURES_DATA_PATH, 'utf8')).clusters;

const BRAND_SOURCES_PATH = resolve(WEBSITE_DIRECTORY, 'src/components/brandIcons.source.json');

const readBrandSources = () =>
  existsSync(BRAND_SOURCES_PATH) ? JSON.parse(readFileSync(BRAND_SOURCES_PATH, 'utf8')) : [];

const githubSlug = (text) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^\w\- ]+/g, '')
    .replace(/\s+/g, '-');

const REPO_DIRECTORY = resolve(WEBSITE_DIRECTORY, '..');

const readDoc = ({ file }) => {
  const path = resolve(REPO_DIRECTORY, file);
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
};

const docHeadings = ({ file }) => {
  const source = readDoc({ file });
  if (source === null) {
    return null;
  }
  return source.split('\n').flatMap((line) => {
    const summary = line.match(/^<summary><h2>(.*)<\/h2><\/summary>/);
    if (summary !== null) {
      return [summary[1]];
    }
    return /^#{1,3} /.test(line) ? [line.replace(/^#{1,3} /, '').trim()] : [];
  });
};

const docAnchors = ({ file }) => {
  const seen = new Map();
  return (docHeadings({ file }) ?? [])
    .map((heading) => githubSlug(heading))
    .map((slug) => {
      const count = seen.get(slug) ?? 0;
      seen.set(slug, count + 1);
      return count === 0 ? slug : `${slug}-${count}`;
    });
};

const anchorCache = new Map();

const anchorsOf = ({ file }) => {
  if (!anchorCache.has(file)) {
    anchorCache.set(file, readDoc({ file }) === null ? null : docAnchors({ file }));
  }
  return anchorCache.get(file);
};

const SHOWN_HELPER = `const isShown = (node) => {
    const box = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && node.closest('[hidden]') === null;
  };
  const describe = (node) => (node.id ? node.tagName.toLowerCase() + '#' + node.id : node.tagName.toLowerCase() + (node.classList.length > 0 ? '.' + node.classList[0] : ''));`;

const PAGE_PROBE = `(async () => {
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
    heroOpacity: heroMock === null ? null : Number(getComputedStyle(heroMock.closest('.rise') ?? heroMock).opacity),
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

const buildRulesProbe = ({ clusterIds }) => `(() => {
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

const TOUCH_PROBE = `(async () => {
  ${SHOWN_HELPER}
  const nextFrame = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  const toggle = document.querySelector('.navMenuButton');
  const hasMenu = toggle !== null && isShown(toggle);
  if (hasMenu) {
    toggle.click();
    await nextFrame();
  }
  const smallText = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let text = walker.nextNode(); text !== null; text = walker.nextNode()) {
    const element = text.parentElement;
    if (element === null || text.textContent.trim() === '' || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(element.tagName) || !isShown(element)) {
      continue;
    }
    const size = parseFloat(getComputedStyle(element).fontSize);
    if (size < ${MIN_TOUCH_FONT_PX}) {
      smallText.add(size + ' px in ' + describe(element) + ': "' + text.textContent.trim().slice(0, 32) + '"');
    }
  }
  const smallTargets = [...document.querySelectorAll('button, .btn, nav a, .navSheet a, .heroFeatures, .installFeatures, .textLink, .refLink, footer a')]
    .filter(isShown)
    .map((node) => ({ node, height: node.getBoundingClientRect().height }))
    .filter(({ height }) => height < ${MIN_TOUCH_TARGET_PX})
    .map(({ node, height }) => height.toFixed(1) + ' px tall: ' + describe(node) + ' "' + node.textContent.trim().slice(0, 24) + '"');
  if (hasMenu) {
    toggle.click();
    await nextFrame();
  }
  return { hasMenu, smallText: [...smallText], smallTargets };
})()`;

const HEADINGS_PROBE = `JSON.stringify([...document.querySelectorAll('h1, h2, h3')].map((node, index) => {
  const box = node.getBoundingClientRect();
  return { index, tag: node.tagName.toLowerCase(), x: box.left, y: box.top + window.scrollY, width: box.width, height: box.height };
}).filter((box) => box.width > 0 && box.height > 0))`;

const scrollThrough = ({ evaluate }) =>
  evaluate(`(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += ${SCROLL_STEP_PX}) {
      window.scrollTo(0, y);
      await new Promise((done) => setTimeout(done, ${SCROLL_PAUSE_MS}));
    }
    await Promise.all([...document.images].filter((image) => image.getClientRects().length > 0).map((image) => image.decode().catch(() => null)));
    window.scrollTo(0, 0);
    return true;
  })()`);

const checkRun = ({ page, viewport, theme, probe, rules, touch, groups, clusterIds, brands }) => {
  const label = `${viewport.name} ${theme}`;
  const failures = [];
  const fail = (message) => failures.push(`${label}: ${message}`);
  const budget = PAGE_BUDGETS[page] ?? {};
  const pageCap = budget.heightByViewport?.[viewport.name];
  const hasDownloadUi = PAGES_WITH_DOWNLOAD.includes(page);
  const isMarketing = MARKETING_PAGES.includes(page);
  if (!probe.isInter) {
    fail('Inter is not loaded');
  }
  if (probe.scrollWidth > probe.clientWidth) {
    fail(`horizontal overflow, ${probe.scrollWidth} px wide in ${probe.clientWidth}`);
  }
  if (pageCap !== undefined && probe.height > pageCap) {
    fail(`page is ${probe.height} px tall, the budget is ${pageCap}`);
  }
  if (viewport.isDesktop === true) {
    rules.sectionHeights
      .filter(
        (section) => budget.sectionMaxPx !== undefined && section.height > budget.sectionMaxPx,
      )
      .forEach((section) =>
        fail(
          `section ${section.name} is ${section.height} px tall, the budget is ${budget.sectionMaxPx}`,
        ),
      );
  }
  const clusterCap = budget.clusterMaxByViewport?.[viewport.name];
  if (clusterCap !== undefined) {
    rules.clusterHeights
      .filter((cluster) => cluster.height > clusterCap)
      .forEach((cluster) =>
        fail(`cluster ${cluster.name} is ${cluster.height} px tall, the budget is ${clusterCap}`),
      );
  }
  if (probe.hasEmDash) {
    fail('an em dash in visible text');
  }
  if (isMarketing && probe.middot !== null) {
    fail(`a middot triplet in visible text: "${probe.middot}"`);
  }
  probe.shadowed.forEach((name) => fail(`a shadow on ${name}`));
  probe.paintedGradients.forEach((name) =>
    fail(`a gradient other than ${STAGE_GRADIENT_TOKEN} paints ${name}`),
  );
  if (page === 'features' && !probe.hasBoard) {
    fail('no board is visible on the page, so the card height rule has nothing to measure');
  }
  if (probe.boardRows.length === 0 && probe.hasBoard) {
    fail('no board card rows were measured');
  }
  probe.boardRows
    .filter((entry) => entry.spread > BOARD_ROW_TOLERANCE_PX)
    .forEach((entry) =>
      fail(
        `board cards in row ${entry.row + 1} differ in height by ${entry.spread.toFixed(1)} px (${entry.heights.join(', ')})`,
      ),
    );
  probe.tablists.forEach((tablist) => {
    if (tablist.selected !== 1) {
      fail(`tablist has ${tablist.selected} selected tabs`);
    }
    if (tablist.invalidControls > 0) {
      fail(`tablist has ${tablist.invalidControls} tabs without a panel`);
    }
  });
  if (isMarketing && !probe.hasMockStage) {
    fail('no .mockStage on the page, so the shadow rule has nothing to check');
  }
  if (viewport.isTouch === true) {
    if (!probe.isCoarse) {
      fail('touch emulation did not give a coarse pointer');
    }
    if (probe.downloads > 0) {
      fail(`${probe.downloads} download links or Homebrew blocks show on a touch device`);
    }
    if (isMarketing && probe.stars === 0) {
      fail('no Star on GitHub button on a touch device');
    }
  } else {
    if (hasDownloadUi && probe.downloads === 0) {
      fail('no download link shows with a fine pointer');
    }
  }
  probe.downloadHrefs
    .filter((href) => !href.startsWith(DOWNLOAD_PREFIX))
    .forEach((href) =>
      fail(`a data-download link goes to ${href}, not a /releases/download/ asset`),
    );
  if (isMarketing) {
    rules.rasters.forEach((image) => fail(`a raster image in main: ${image}`));
  }
  probe.brokenImages.forEach((source) => fail(`${source} did not load`));
  probe.periods.forEach((text) => fail(`heading ends with a period: "${text}"`));
  probe.collisions.forEach((message) => fail(message));
  probe.spills.forEach((message) => fail(message));
  if (page === 'home') {
    if (rules.heroMock === null) {
      fail('no [data-hero-mock] on the home page');
    } else if (viewport.isDesktop === true) {
      const visible =
        Math.min(rules.heroMock.bottom, HERO_FIRST_SCREEN_PX) - Math.max(rules.heroMock.top, 0);
      if (visible < HERO_MOCK_VISIBLE_PX) {
        fail(
          `${Math.round(Math.max(visible, 0))} px of the hero mock show in the first ${HERO_FIRST_SCREEN_PX} px, at least ${HERO_MOCK_VISIBLE_PX} are needed`,
        );
      }
    }
    if (viewport.isFirstScreen === true) {
      if (rules.worksWith === null) {
        fail('no [data-works-with] on the home page');
      } else if (rules.worksWith.top < 0 || rules.worksWith.bottom > viewport.height) {
        fail(
          `Works with spans ${Math.round(rules.worksWith.top)} to ${Math.round(rules.worksWith.bottom)} px, the first screen is ${viewport.height} px`,
        );
      }
    }
    rules.headingEdges.forEach((message) => fail(message));
  }
  if (probe.heroOpacity !== null && probe.heroOpacity < 1) {
    fail(`the hero mock is at opacity ${probe.heroOpacity} after load`);
  }
  if (probe.bannerCoversH1) {
    fail('the consent card covers the h1');
  }
  rules.rowCollisions.forEach((message) => fail(`run row: ${message}`));
  if (viewport.isDesktop === true) {
    rules.alsoLines
      .filter((entry) => entry.lines > MAX_ALSO_LINES)
      .forEach((entry) =>
        fail(
          `the Also line "${entry.name}" runs ${entry.lines} lines, the limit is ${MAX_ALSO_LINES}`,
        ),
      );
  }
  rules.crowded.forEach((message) => fail(message));
  rules.sameTone.forEach((message) => fail(message));
  rules.cardEdges.forEach((message) => fail(message));
  probe.eyebrows
    .filter((eyebrow) => eyebrow.group !== null && !groups.includes(eyebrow.group))
    .forEach((eyebrow) => fail(`eyebrow "${eyebrow.text}" is not a FEATURES.md group`));
  probe.eyebrows
    .filter((eyebrow) => eyebrow.group === null)
    .filter((eyebrow) => !PAGE_EYEBROWS.includes(eyebrow.text))
    .forEach((eyebrow) => fail(`eyebrow "${eyebrow.text}" names neither a feature nor a page`));
  if (isMarketing) {
    rules.longSentences.forEach((message) =>
      fail(`a sentence over ${MAX_SENTENCE_WORDS} words, ${message}`),
    );
    rules.copyRepeats.forEach((message) => fail(message));
  }
  probe.brandPaths.forEach((mark) => {
    const source = brands.find((entry) => entry.id === mark.brand);
    if (source === undefined) {
      fail(`provider mark ${mark.brand} has no pinned source`);
      return;
    }
    if (source.path !== mark.d) {
      fail(`provider mark ${mark.brand} differs from simple-icons ${source.slug}`);
    }
  });
  probe.brandInkColors
    .filter((mark) => mark.color === mark.ink)
    .forEach((mark) => fail(`provider mark ${mark.brand} uses the text color`));
  rules.seeMoreLinks.forEach((href) => {
    const match = (href ?? '').match(/^\/features#(.+)$/);
    if (match === null || !clusterIds.includes(match[1])) {
      fail(`see-more link ${href} is not /features# with a cluster id`);
    }
  });
  rules.guideLinks.forEach((link) => {
    const isContentDocLink = !isMarketing && link.href.startsWith(SITE_DOCS_PREFIX);
    if (!link.isAllowed && !isContentDocLink) {
      fail(`doc link ${link.href} sits outside .refLink and the footer`);
    }
    const [path, anchor = null] = link.href.startsWith(SITE_DOCS_PREFIX)
      ? siteDocTarget({ href: link.href })
      : link.href.slice(REPO_BLOB_PREFIX.length).split('#');
    const isGuide = path === 'FEATURES.md' || /^docs\/features\/[a-z-]+\.md$/.test(path);
    if (!isGuide) {
      fail(`doc link ${link.href} is neither FEATURES.md nor a docs/features/<area>.md file`);
      return;
    }
    const anchors = anchorsOf({ file: path });
    if (anchors === null) {
      fail(`doc link ${link.href} points at a file that does not exist`);
    } else if (anchor !== null && !anchors.includes(anchor)) {
      fail(`doc link ${link.href} has no matching heading in ${path}`);
    }
  });
  if (touch !== null) {
    touch.smallText.forEach((message) => fail(`text under ${MIN_TOUCH_FONT_PX} px, ${message}`));
    touch.smallTargets.forEach((message) =>
      fail(`touch target under ${MIN_TOUCH_TARGET_PX} px, ${message}`),
    );
    if (!touch.hasMenu) {
      fail('no visible menu button on a touch device');
    }
  }
  return failures;
};

const checkCoverage = ({ groups, clusters, featuresIds }) => {
  const covered = clusters.flatMap((cluster) => cluster.groups);
  const failures = groups
    .filter((group) => !covered.includes(group))
    .map(
      (group) => `coverage: FEATURES.md group "${group}" is in no cluster of features.data.json`,
    );
  if (featuresIds !== null) {
    clusters
      .filter((cluster) => !featuresIds.includes(cluster.id))
      .forEach((cluster) =>
        failures.push(`coverage: cluster "${cluster.id}" has no element with that id on /features`),
      );
  }
  return failures;
};

const MASK_PROPERTY = /^(-webkit-)?mask(-|$)/;
const GRADIENT = /(?:repeating-)?(?:linear|radial|conic)-gradient\(/g;

const sourceFiles = ({ directory }) =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      return sourceFiles({ directory: path });
    }
    return /\.(css|tsx?)$/.test(name) ? [path] : [];
  });

const checkGradients = () => {
  const failures = [];
  sourceFiles({ directory: SOURCE_DIRECTORY }).forEach((file) => {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(GRADIENT)) {
      const before = source.slice(0, match.index);
      const declarationStart = Math.max(
        before.lastIndexOf(';'),
        before.lastIndexOf('{'),
        before.lastIndexOf('}'),
      );
      const declaration = before.slice(declarationStart + 1);
      const property = declaration.split(':')[0].trim();
      const blockStart = before.lastIndexOf('{');
      const blockEnd = source.indexOf('}', match.index);
      const block = blockStart === -1 || blockEnd === -1 ? '' : source.slice(blockStart, blockEnd);
      const isMasked = block.split(';').some((line) =>
        MASK_PROPERTY.test(
          line
            .replace(/^[\s{]*/, '')
            .split(':')[0]
            .trim(),
        ),
      );
      const isAllowed =
        property === STAGE_GRADIENT_TOKEN || MASK_PROPERTY.test(property) || isMasked;
      if (!isAllowed) {
        const line = before.split('\n').length;
        failures.push(
          `gradients: ${file.slice(WEBSITE_DIRECTORY.length + 1)}:${line} paints a gradient through "${property}"; only ${STAGE_GRADIENT_TOKEN} and mask rings may`,
        );
      }
    }
  });
  const definitions = sourceFiles({ directory: SOURCE_DIRECTORY }).filter((file) =>
    new RegExp(`${STAGE_GRADIENT_TOKEN}:\\s*(linear|radial|conic)-gradient`).test(
      readFileSync(file, 'utf8'),
    ),
  );
  if (definitions.length !== 1) {
    failures.push(
      `gradients: ${STAGE_GRADIENT_TOKEN} must be defined exactly once, found ${definitions.length}`,
    );
  }
  return failures;
};

const guideEntries = ({ area }) => {
  const source = readDoc({ file: `${FEATURE_DOCS_DIRECTORY}/${area}.md` });
  if (source === null) {
    return null;
  }
  const lines = source.split('\n');
  const headings = lines
    .filter((line) => line.startsWith('### '))
    .map((line) => line.slice(4).trim());
  const rows = lines
    .filter((line) => /^\| /.test(line) && !/^\| (-|Feature)/.test(line))
    .map((line) => line.split('|')[1].trim());
  return {
    h1: (lines.find((line) => line.startsWith('# ')) ?? '').slice(2).trim(),
    headings,
    rows,
  };
};

const indexMainItems = () => {
  const index = new Map();
  let current = null;
  (readDoc({ file: 'FEATURES.md' }) ?? '').split('\n').forEach((line) => {
    if (line.startsWith('## ')) {
      current = line.slice(3).trim();
      index.set(current, []);
    } else if (current !== null && line.startsWith('- ')) {
      index.get(current).push(line.slice(2).trim());
    }
  });
  return index;
};

const checkClusters = ({ clusters }) => {
  const failures = [];
  const index = indexMainItems();
  clusters.forEach((cluster) => {
    const fail = (message) => failures.push(`cluster ${cluster.id}: ${message}`);
    const mains = cluster.items.filter((item) => item.main === true);
    if (mains.length < 3 || mains.length > 5) {
      fail(`${mains.length} main items, 3 to 5 are needed`);
    }
    cluster.items
      .filter((item) => item.main !== true && (item.also ?? '').trim() === '')
      .forEach((item) => fail(`"${item.title}" is neither a main item nor has an also noun`));
    if (cluster.guides.length === 0) {
      fail('no guide link');
    }
    const known = new Set();
    const indexed = new Set();
    cluster.guides.forEach((guide) => {
      const entries = guideEntries({ area: guide.area });
      if (entries === null) {
        fail(`guide area ${guide.area} has no docs/features/${guide.area}.md`);
        return;
      }
      if (entries.h1 !== guide.label) {
        fail(`guide label "${guide.label}" is not the title "${entries.h1}" of ${guide.area}.md`);
      }
      if (!cluster.groups.includes(guide.label)) {
        fail(`guide "${guide.label}" is not one of the cluster groups`);
      }
      [...entries.headings, ...entries.rows].forEach((title) => known.add(title));
      (index.get(guide.label) ?? []).forEach((title) => indexed.add(title));
      entries.headings
        .filter((title) => !cluster.items.some((item) => item.title === title))
        .forEach((title) => fail(`guide entry "${title}" of ${guide.area}.md is not an item`));
    });
    cluster.items
      .filter((item) => !known.has(item.title))
      .forEach((item) => fail(`item "${item.title}" is in none of the guide files`));
    mains
      .filter((item) => !indexed.has(item.title))
      .forEach((item) =>
        fail(`main item "${item.title}" is not a main item of the FEATURES.md index`),
      );
    cluster.items
      .filter((item) => !cluster.groups.includes(item.group))
      .forEach((item) => fail(`item "${item.title}" has the unknown group "${item.group}"`));
  });
  return failures;
};

const captureHeadings = async ({ send, evaluate, shots, viewport, theme, page }) => {
  mkdirSync(shots, { recursive: true });
  const boxes = JSON.parse(await evaluate(HEADINGS_PROBE));
  for (const box of boxes) {
    const response = await send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
      clip: {
        x: Math.max(0, box.x - 8),
        y: Math.max(0, box.y - 8),
        width: Math.min(viewport.width, box.width + 16),
        height: box.height + 16,
        scale: 1,
      },
    });
    const name = `${page}-${viewport.name}-${theme}-${String(box.index).padStart(2, '0')}-${box.tag}.png`;
    writeFileSync(join(shots, name), Buffer.from(response.result.data, 'base64'));
  }
};

const verifyIcons = async ({ brands }) => {
  const failures = [];
  for (const brand of brands) {
    const url = `https://cdn.jsdelivr.net/npm/simple-icons@${brand.version}/icons/${brand.slug}.svg`;
    try {
      const svg = await (await fetch(url)).text();
      const path = svg.match(/<path d="([^"]+)"/)?.[1];
      if (path !== brand.path) {
        failures.push(`icons: ${brand.id} does not match ${url}`);
      }
    } catch {
      failures.push(`icons: could not read ${url}`);
    }
  }
  return failures;
};

const pageName = ({ url }) => new URL(url).pathname.replace(/\//g, '') || 'home';

const run = async () => {
  const { urls, shots, isVerifyingIcons } = parseArgs({ argv: process.argv.slice(2) });
  const groups = readGroups({ file: 'FEATURES.md' });
  const clusters = readClusters();
  const clusterIds = clusters.map((cluster) => cluster.id);
  const rulesProbe = buildRulesProbe({ clusterIds });
  const brands = readBrandSources();
  const chrome = await launchChrome();
  const timer = setTimeout(() => {
    console.error('check-page: timed out');
    chrome.close();
    process.exit(1);
  }, TIMEOUT_MS);
  const cdp = await connect({ socketUrl: chrome.socketUrl });
  const failures = [];
  const heights = [];
  let featuresIds = null;
  try {
    await cdp.send('Page.enable');
    await cdp.send('Network.enable');
    await cdp.send('Network.setBlockedURLs', { urls: BLOCKED_URLS });
    for (const url of urls) {
      const page = pageName({ url });
      for (const viewport of VIEWPORTS) {
        for (const theme of THEMES) {
          await cdp.send('Emulation.setDeviceMetricsOverride', {
            width: viewport.width,
            height: viewport.height,
            deviceScaleFactor: 2,
            mobile: viewport.isMobile,
          });
          await cdp.send('Emulation.setTouchEmulationEnabled', {
            enabled: viewport.isTouch === true,
            maxTouchPoints: viewport.isTouch === true ? 5 : 1,
          });
          await cdp.send('Emulation.setEmulatedMedia', {
            features: [{ name: 'prefers-color-scheme', value: theme }],
          });
          await cdp.send('Page.navigate', { url });
          await sleep(SETTLE_MS);
          await scrollThrough(cdp);
          await sleep(SETTLE_MS);
          const probe = await cdp.evaluate(PAGE_PROBE);
          const rules = await cdp.evaluate(rulesProbe);
          const touch = viewport.isTouch === true ? await cdp.evaluate(TOUCH_PROBE) : null;
          if (page === 'features' && featuresIds === null) {
            featuresIds = rules.ids;
          }
          const parts = [
            ...rules.sectionHeights,
            ...(page === 'features' ? rules.clusterHeights : []),
          ]
            .map((part) => `${part.name} ${part.height}`)
            .join(', ');
          heights.push(
            `${page} ${viewport.name} ${theme}: ${probe.height} px${viewport.isDesktop === true ? ` (${parts})` : ''}`,
          );
          failures.push(
            ...checkRun({
              page,
              viewport,
              theme,
              probe,
              rules,
              touch,
              groups,
              clusterIds,
              brands,
            }).map((failure) => `${page} ${failure}`),
          );
          if (shots !== null) {
            await captureHeadings({ ...cdp, shots, viewport, theme, page });
          }
        }
      }
    }
    failures.push(...checkCoverage({ groups, clusters, featuresIds }));
    failures.push(...checkGradients());
    failures.push(...checkClusters({ clusters }));
    if (isVerifyingIcons) {
      failures.push(...(await verifyIcons({ brands })));
    }
  } finally {
    clearTimeout(timer);
    cdp.close();
    chrome.close();
  }
  heights.forEach((line) => console.log(line));
  if (failures.length > 0) {
    console.error(`check-page: ${failures.length} failures\n${failures.join('\n')}`);
    process.exitCode = 1;
    return;
  }
  console.log('check-page: ok');
};

await run();

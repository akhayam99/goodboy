import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const WEBSITE_DIRECTORY = resolve(SCRIPT_DIRECTORY, '..');
const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DEFAULT_URL = 'http://localhost:1499/';
const BLOCKED_URLS = ['*googletagmanager.com*', '*google-analytics.com*'];
const SETTLE_MS = 1200;
const SCROLL_STEP_PX = 600;
const SCROLL_PAUSE_MS = 60;
const TIMEOUT_MS = 240000;
const MIN_DENSITY = 2;
const HERO_FRAME_VISIBLE_PX = 380;
const INTER_PROBE = '500 64px Inter';
const REPO_BLOB_PREFIX = 'https://github.com/akhayam99/goodboy/blob/main/';
const FEATURE_GUIDE_URL = `${REPO_BLOB_PREFIX}FEATURES.md`;

const VIEWPORTS = [
  {
    name: 'desktop',
    width: 1440,
    height: 900,
    isMobile: false,
    maxHeight: 13500,
    isHeroChecked: true,
  },
  { name: 'laptop', width: 1024, height: 768, isMobile: false, maxHeight: Infinity },
  { name: 'tablet', width: 768, height: 1024, isMobile: false, maxHeight: Infinity },
  { name: 'narrow', width: 660, height: 900, isMobile: false, maxHeight: Infinity },
  { name: 'phone', width: 390, height: 844, isMobile: true, maxHeight: 14000 },
];
const OVERLAP_TOLERANCE_PX = 1;
const THEMES = ['dark', 'light'];
const PAGE_EYEBROWS = ['Desktop ADE for macOS and Linux', 'Questions', 'Install', 'All features'];

const parseArgs = ({ argv }) => {
  const shotsIndex = argv.indexOf('--shots');
  const shots = shotsIndex === -1 ? null : resolve(argv[shotsIndex + 1]);
  const positional = argv.filter(
    (value, index) => !value.startsWith('--') && argv[index - 1] !== '--shots',
  );
  return {
    urls: positional.length > 0 ? positional : [DEFAULT_URL],
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

const readHeadings = ({ file }) =>
  readFileSync(resolve(WEBSITE_DIRECTORY, '..', file), 'utf8')
    .split('\n')
    .filter((line) => line.startsWith('## '))
    .map((line) => line.slice(3).trim());

const BRAND_SOURCES_PATH = resolve(WEBSITE_DIRECTORY, 'src/components/brandIcons.source.json');

const readBrandSources = () =>
  existsSync(BRAND_SOURCES_PATH) ? JSON.parse(readFileSync(BRAND_SOURCES_PATH, 'utf8')) : [];

const githubSlug = (text) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^\w\- ]+/g, '')
    .replace(/\s+/g, '-');

const readFeatureAnchors = () => {
  const seen = new Map();
  return readFileSync(resolve(WEBSITE_DIRECTORY, '..', 'FEATURES.md'), 'utf8')
    .split('\n')
    .filter((line) => /^#{2,3} /.test(line))
    .map((line) => githubSlug(line.replace(/^#{2,3} /, '')))
    .map((slug) => {
      const count = seen.get(slug) ?? 0;
      seen.set(slug, count + 1);
      return count === 0 ? slug : `${slug}-${count}`;
    });
};

const PAGE_PROBE = `(async () => {
  await document.fonts.ready;
  const root = document.documentElement;
  const text = document.body.innerText;
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
  const shadowed = [...document.querySelectorAll('.frame, .frame *, .frag, .frag *, .grid, .grid *')]
    .filter((node) => !node.hasAttribute('data-shadow-exception'))
    .filter((node) => isShadow(getComputedStyle(node).boxShadow) || getComputedStyle(node).filter.includes('drop-shadow'))
    .map((node) => String(node.className || node.tagName));
  const images = [...document.querySelectorAll('picture img')].map((image) => {
    const box = image.getBoundingClientRect();
    const file = image.currentSrc.split('/').pop();
    const pixels = Number((file.match(/-(\\d+)(?:-light)?\\.webp$/) ?? [])[1] ?? image.naturalWidth);
    return {
      src: file,
      isLoaded: image.complete && image.naturalWidth > 0,
      density: box.width > 0 ? pixels / box.width : null,
    };
  });
  const heroFrame = document.querySelector('.hero .frame');
  const heroBox = heroFrame === null ? null : heroFrame.getBoundingClientRect();
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
  const overlaps = (a, b) => !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
  return {
    isInter: document.fonts.check(${JSON.stringify(INTER_PROBE)}),
    scrollWidth: root.scrollWidth,
    clientWidth: root.clientWidth,
    height: root.scrollHeight,
    hasEmDash: text.includes('\\u2014'),
    middot: (text.match(middot) ?? [null])[0],
    shadowed,
    images,
    periods,
    collisions,
    spills,
    heroTop: heroBox === null ? null : heroBox.top + window.scrollY,
    heroOpacity: heroFrame === null ? null : Number(getComputedStyle(heroFrame.closest('.rise') ?? heroFrame).opacity),
    bannerCoversH1: banner !== null && h1 !== null && overlaps(banner.getBoundingClientRect(), h1.getBoundingClientRect()),
    eyebrows: [...document.querySelectorAll('.eyebrow')].map((node) => ({
      text: node.textContent.trim(),
      group: node.getAttribute('data-group'),
      audience: node.getAttribute('data-audience'),
    })),
    brandPaths: [...document.querySelectorAll('svg[data-brand] path')].map((node) => ({
      brand: node.closest('svg').getAttribute('data-brand'),
      d: node.getAttribute('d'),
    })),
    docLinks: [...document.querySelectorAll('.textLink')].map((node) => node.getAttribute('href')),
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
    await Promise.all([...document.images].map((image) => image.decode().catch(() => null)));
    window.scrollTo(0, 0);
    return true;
  })()`);

const checkRun = ({ viewport, theme, probe, groups, audiences, brands, featureAnchors }) => {
  const label = `${viewport.name} ${theme}`;
  const failures = [];
  const fail = (message) => failures.push(`${label}: ${message}`);
  if (!probe.isInter) {
    fail('Inter is not loaded');
  }
  if (probe.scrollWidth > probe.clientWidth) {
    fail(`horizontal overflow, ${probe.scrollWidth} px wide in ${probe.clientWidth}`);
  }
  if (probe.height > viewport.maxHeight) {
    fail(`page is ${probe.height} px tall, the budget is ${viewport.maxHeight}`);
  }
  if (probe.hasEmDash) {
    fail('an em dash in visible text');
  }
  if (probe.middot !== null) {
    fail(`a middot triplet in visible text: "${probe.middot}"`);
  }
  probe.shadowed.forEach((name) => fail(`a shadow on ${name}`));
  probe.images
    .filter((image) => !image.isLoaded)
    .forEach((image) => fail(`${image.src} did not load`));
  probe.images
    .filter((image) => image.density !== null && image.density < MIN_DENSITY)
    .forEach((image) => fail(`${image.src} drawn at ${image.density.toFixed(2)}x`));
  probe.periods.forEach((text) => fail(`heading ends with a period: "${text}"`));
  probe.collisions.forEach((message) => fail(message));
  probe.spills.forEach((message) => fail(message));
  if (viewport.isHeroChecked === true && probe.heroTop !== null) {
    if (probe.heroTop + HERO_FRAME_VISIBLE_PX > viewport.height) {
      fail(`the hero frame starts at ${Math.round(probe.heroTop)} px, below the first screen`);
    }
  }
  if (probe.heroOpacity !== null && probe.heroOpacity < 1) {
    fail(`the hero frame is at opacity ${probe.heroOpacity} after load`);
  }
  if (probe.bannerCoversH1) {
    fail('the consent card covers the h1');
  }
  probe.eyebrows
    .filter((eyebrow) => eyebrow.group !== null && !groups.includes(eyebrow.group))
    .forEach((eyebrow) => fail(`eyebrow "${eyebrow.text}" is not a FEATURES.md group`));
  probe.eyebrows
    .filter((eyebrow) => eyebrow.audience !== null && !audiences.includes(eyebrow.audience))
    .forEach((eyebrow) => fail(`eyebrow "${eyebrow.text}" is not a README.md section`));
  probe.eyebrows
    .filter((eyebrow) => eyebrow.group === null && eyebrow.audience === null)
    .filter((eyebrow) => !PAGE_EYEBROWS.includes(eyebrow.text))
    .forEach((eyebrow) => fail(`eyebrow "${eyebrow.text}" names neither a feature nor a page`));
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
  probe.docLinks.forEach((href) => {
    if (!href.startsWith(REPO_BLOB_PREFIX)) {
      return;
    }
    if (!href.startsWith(FEATURE_GUIDE_URL)) {
      fail(`doc link ${href} does not point to FEATURES.md`);
      return;
    }
    const anchor = href.includes('#') ? href.split('#')[1] : null;
    if (anchor !== null && !featureAnchors.includes(anchor)) {
      fail(`doc link ${href} has no matching FEATURES.md anchor`);
    }
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
  const groups = readHeadings({ file: 'FEATURES.md' });
  const audiences = readHeadings({ file: 'README.md' });
  const brands = readBrandSources();
  const featureAnchors = readFeatureAnchors();
  const chrome = await launchChrome();
  const timer = setTimeout(() => {
    console.error('check-page: timed out');
    chrome.close();
    process.exit(1);
  }, TIMEOUT_MS);
  const cdp = await connect({ socketUrl: chrome.socketUrl });
  const failures = [];
  const heights = [];
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
          await cdp.send('Emulation.setEmulatedMedia', {
            features: [{ name: 'prefers-color-scheme', value: theme }],
          });
          await cdp.send('Page.navigate', { url });
          await sleep(SETTLE_MS);
          await scrollThrough(cdp);
          await sleep(SETTLE_MS);
          const probe = await cdp.evaluate(PAGE_PROBE);
          heights.push(`${page} ${viewport.name} ${theme}: ${probe.height} px`);
          failures.push(
            ...checkRun({ viewport, theme, probe, groups, audiences, brands, featureAnchors }).map(
              (failure) => `${page} ${failure}`,
            ),
          );
          if (shots !== null) {
            await captureHeadings({ ...cdp, shots, viewport, theme, page });
          }
        }
      }
    }
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

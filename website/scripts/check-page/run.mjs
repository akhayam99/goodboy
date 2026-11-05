import { checkRun } from './checks/checkRun.mjs';
import { checkClusters } from './checks/checkClusters.mjs';
import { checkCoverage } from './checks/checkCoverage.mjs';
import { checkGradients } from './checks/checkGradients.mjs';
import { captureHeadings } from './captureHeadings.mjs';
import { connect } from './connect.mjs';
import { launchChrome } from './launchChrome.mjs';
import { parseArgs } from './parseArgs.mjs';
import { PAGE_PROBE } from './probes/pageProbe.mjs';
import { buildRulesProbe } from './probes/rulesProbe.mjs';
import { scrollThrough } from './probes/scrollThrough.mjs';
import { TOUCH_PROBE } from './probes/touchProbe.mjs';
import { readBrandSources } from './readers/readBrandSources.mjs';
import { readClusters } from './readers/readClusters.mjs';
import { readGroups } from './readers/readGroups.mjs';
import { sleep } from './sleep.mjs';
import { THEMES, VIEWPORTS } from './viewports.mjs';
import { verifyIcons } from './verifyIcons.mjs';

const BLOCKED_URLS = ['*googletagmanager.com*', '*google-analytics.com*'];
const SETTLE_MS = 1200;
const TIMEOUT_MS = 480000;

const pageName = ({ url }) => new URL(url).pathname.replace(/\//g, '') || 'home';

export const run = async () => {
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

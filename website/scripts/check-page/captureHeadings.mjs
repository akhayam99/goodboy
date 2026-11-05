import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { HEADINGS_PROBE } from './probes/headingsProbe.mjs';

export const captureHeadings = async ({ send, evaluate, shots, viewport, theme, page }) => {
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

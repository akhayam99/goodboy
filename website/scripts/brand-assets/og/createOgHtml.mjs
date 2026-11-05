import { createBaseHtml } from '../html/createBaseHtml.mjs';
import { createMascot } from '../html/createMascot.mjs';
import { MARK_SCALE, TILE_RADIUS_RATIO } from '../tileMetrics.mjs';

const createOgMarks = ({ brands, size }) =>
  brands
    .map(
      ({ id, path, color }) =>
        `<svg aria-label="${id}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}"><path d="${path}"/></svg>`,
    )
    .join('');

export const createOgHtml = ({
  format,
  theme,
  tileColor,
  mascotBase64,
  providerBrands,
  toolBrands,
}) => {
  const content = `
    <div class="top">
      <div class="brand"><span class="tile">${createMascot({ className: 'mascot', mascotBase64 })}</span><span>Goodboy</span></div>
      <span class="pill">Free desktop ADE, built in public</span>
    </div>
    <h1>Stop <em>re&#8209;explaining</em> yourself</h1>
    <div class="foot">
      <div class="group"><small>Works with</small><span class="marks">${createOgMarks({ brands: providerBrands, size: 30 })}</span></div>
      <div class="group"><small>Plugs into</small><span class="marks tools">${createOgMarks({ brands: toolBrands, size: 26 })}</span></div>
    </div>`;
  return createBaseHtml({
    width: format.width,
    height: format.height,
    accent: theme.accent,
    bodyClass: 'og',
    content,
    extraCss: `
      body { background: ${theme.stage}; color: ${theme.foreground}; padding: 64px 76px 104px; display: flex; flex-direction: column }
      .top { display: flex; align-items: center; justify-content: space-between }
      .brand { display: flex; align-items: center; gap: 16px }
      .brand .tile { width: 60px; height: 60px; border-radius: ${60 * TILE_RADIUS_RATIO}px; background: ${tileColor}; box-shadow: inset 0 0 0 1.5px ${theme.tileRing}; display: grid; place-items: center }
      .brand .mascot { width: ${60 * MARK_SCALE}px; height: ${60 * MARK_SCALE}px; background: #fff }
      .brand > span:last-child { font-size: 38px; font-weight: 600; letter-spacing: -0.015em }
      .pill { padding: 10px 18px; border-radius: 999px; font-size: 20px; font-weight: 500; color: ${theme.secondary}; box-shadow: inset 0 0 0 1.5px rgb(255 255 255 / 0.14); background: rgb(255 255 255 / 0.04) }
      h1 { margin-top: auto; font-size: 96px; font-weight: 500; line-height: 1.02; letter-spacing: -0.025em }
      h1 em { font-style: normal; color: ${theme.accent} }
      .foot { margin-top: 48px; display: flex; align-items: center; gap: 64px }
      .group { display: flex; align-items: center; gap: 18px }
      .group small { font-size: 18px; color: ${theme.muted}; letter-spacing: 0.01em }
      .marks { display: flex; align-items: center; gap: 14px }
      .marks.tools { opacity: 0.62 }
    `,
  });
};

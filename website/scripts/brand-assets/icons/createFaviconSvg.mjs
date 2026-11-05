import { FAVICON_CANVAS_PX, MARK_SCALE, TILE_RADIUS_RATIO } from '../tileMetrics.mjs';

export const createFaviconSvg = ({ tileColor, glyphBase64 }) => {
  const markSize = FAVICON_CANVAS_PX * MARK_SCALE;
  const markInset = (FAVICON_CANVAS_PX - markSize) / 2;
  const tileRadius = FAVICON_CANVAS_PX * TILE_RADIUS_RATIO;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FAVICON_CANVAS_PX} ${FAVICON_CANVAS_PX}">
  <rect width="${FAVICON_CANVAS_PX}" height="${FAVICON_CANVAS_PX}" rx="${tileRadius}" fill="${tileColor}"/>
  <image x="${markInset}" y="${markInset}" width="${markSize}" height="${markSize}" href="data:image/png;base64,${glyphBase64}"/>
</svg>
`;
};

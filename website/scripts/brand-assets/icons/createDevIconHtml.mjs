import {
  APP_ICON_MARK_SCALE_EXCEPTION,
  DEV_ICON_CONTENT_RATIO,
  DEV_ICON_CORNER_RADIUS_RATIO,
} from '../tileMetrics.mjs';

export const createDevIconHtml = ({ tileColor, mascotBase64, canvasPx }) => {
  const contentPx = canvasPx * DEV_ICON_CONTENT_RATIO;
  const markPx = contentPx * APP_ICON_MARK_SCALE_EXCEPTION;
  return `<!doctype html>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box }
  html, body { width: ${canvasPx}px; height: ${canvasPx}px; background: transparent; overflow: hidden }
  body { display: grid; place-items: center }
  .tile { width: ${contentPx}px; height: ${contentPx}px; border-radius: ${contentPx * DEV_ICON_CORNER_RADIUS_RATIO}px; background: ${tileColor}; display: grid; place-items: center }
  .mascot { display: block; width: ${markPx}px; height: ${markPx}px; background: #fff; -webkit-mask: url(data:image/png;base64,${mascotBase64}) no-repeat center / contain }
</style>
<body><div class="tile"><i class="mascot"></i></div></body>`;
};

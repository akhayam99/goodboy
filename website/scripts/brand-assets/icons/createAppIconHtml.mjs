import { APP_ICON_MARK_PX, APP_ICON_PX } from '../tileMetrics.mjs';

export const createAppIconHtml = ({ tileColor, mascotBase64 }) => `<!doctype html>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box }
  html, body { width: ${APP_ICON_PX}px; height: ${APP_ICON_PX}px; background: ${tileColor}; overflow: hidden }
  body { display: grid; place-items: center }
  .mascot { display: block; width: ${APP_ICON_MARK_PX}px; height: ${APP_ICON_MARK_PX}px; background: #fff; -webkit-mask: url(data:image/png;base64,${mascotBase64}) no-repeat center / contain }
</style>
<body><i class="mascot"></i></body>`;

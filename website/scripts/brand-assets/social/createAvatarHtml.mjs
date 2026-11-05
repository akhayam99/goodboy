import { createBaseHtml } from '../html/createBaseHtml.mjs';
import { createMascot } from '../html/createMascot.mjs';

export const createAvatarHtml = ({ format, accent, mascotBase64 }) =>
  createBaseHtml({
    width: format.width,
    height: format.height,
    accent,
    bodyClass: 'avatar',
    content: createMascot({ className: 'mascot', mascotBase64 }),
    extraCss: `
    body { display: grid; place-items: center; padding: 18% }
    .mascot { width: 60vh; height: 60vh }
  `,
  });

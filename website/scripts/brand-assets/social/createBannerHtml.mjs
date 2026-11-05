import { createBaseHtml } from '../html/createBaseHtml.mjs';
import { createLockupHtml } from '../html/createLockupHtml.mjs';

export const createBannerHtml = ({ format, accent, mascotBase64, variant }) => {
  const isXHeader = variant === 'x-header';
  const tagline = isXHeader ? 'Your agents, in the right order.' : '';
  return createBaseHtml({
    width: format.width,
    height: format.height,
    accent,
    bodyClass: variant,
    content: createLockupHtml({ mascotBase64, tagline }),
    extraCss: `
      body { display: flex; align-items: center; justify-content: flex-end; padding: ${isXHeader ? '9% 10% 9% 35%' : '8% 9% 8% 34%'} }
      .lockup { display: flex; align-items: center; gap: ${isXHeader ? '34px' : '24px'} }
      .mascot { width: ${isXHeader ? '138px' : '104px'}; height: ${isXHeader ? '138px' : '104px'}; flex: none }
      .lockup-copy { display: flex; flex-direction: column; gap: 10px }
      .lockup-copy span { font-size: ${isXHeader ? '86px' : '68px'}; font-weight: 600; letter-spacing: -0.025em; line-height: 1 }
      .lockup-copy small { color: #495057; font-size: 30px; white-space: nowrap }
    `,
  });
};

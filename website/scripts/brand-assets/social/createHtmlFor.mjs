import { createOgHtml } from '../og/createOgHtml.mjs';
import { createAvatarHtml } from './createAvatarHtml.mjs';
import { createBannerHtml } from './createBannerHtml.mjs';

export const createHtmlFor = ({ format, accent, tileColor, mascotBase64, ogTheme }) => {
  if (format.surface === 'og-image') {
    return createOgHtml({
      format,
      theme: ogTheme,
      tileColor,
      mascotBase64,
      providerBrands: ogTheme.providerBrands,
      toolBrands: ogTheme.toolBrands,
    });
  }
  if (format.surface === 'X avatar') {
    return createAvatarHtml({ format, accent, mascotBase64 });
  }
  const variants = {
    'X header': 'x-header',
    'LinkedIn company cover': 'linkedin-company-cover',
    'LinkedIn profile background': 'linkedin-profile-background',
  };
  const variant = variants[format.surface];
  if (variant !== undefined) {
    return createBannerHtml({ format, accent, mascotBase64, variant });
  }
  throw new Error(`No brand asset layout exists for ${format.surface}`);
};

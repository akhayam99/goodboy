const HTTP_URL = /^https?:\/\//;

export const isThirdParty = ({ url, pageOrigin }) =>
  url !== undefined && HTTP_URL.test(url) && new URL(url).origin !== pageOrigin;

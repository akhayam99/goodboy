import type { IntegrationGlyphProvider } from '../../../../integrations/components/IntegrationGlyph';

type Params = {
  readonly url: string;
};

export const codeHostFromUrl = ({ url }: Params): IntegrationGlyphProvider => {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes('bitbucket')) {
      return 'bitbucket';
    }
    if (host.includes('gitlab')) {
      return 'gitlab';
    }
    return 'github';
  } catch {
    return 'github';
  }
};

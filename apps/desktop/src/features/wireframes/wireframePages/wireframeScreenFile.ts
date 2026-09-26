export const WIREFRAME_SCREENS_DIR = 'screens';

export const wireframeScreenFile = ({ screenId }: { readonly screenId: string }): string =>
  `${screenId}.html`;

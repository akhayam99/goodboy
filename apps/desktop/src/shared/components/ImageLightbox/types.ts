type ImageLightboxSource =
  | { readonly status: 'ready'; readonly src: string }
  | { readonly status: 'loading' }
  | { readonly status: 'failed' };

export type ImageLightboxItem = {
  readonly id: string;
  readonly alt: string;
  readonly source: ImageLightboxSource;
  readonly media?: 'image' | 'pdf';
};

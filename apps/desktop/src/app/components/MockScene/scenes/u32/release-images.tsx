import type { ComponentType } from 'react';
import { ReleaseImagesScene } from './ReleaseImagesScene';

export const U32_RELEASE_IMAGES_SCENES = {
  'u32-release-images': ReleaseImagesScene,
} satisfies Readonly<Record<string, ComponentType>>;

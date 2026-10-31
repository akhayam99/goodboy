import { useEffect, useState } from 'react';
import { ReleaseImage } from '../../../../../features/changelog/components/ReleaseImage';
import { mockSceneIpc } from '../mockSceneIpc';
import {
  RELEASE_IMAGE_CASES,
  RELEASE_IMAGE_VERSION,
  releaseImageDataUriOf,
} from './releaseImagesSeed';

export const ReleaseImagesScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    mockSceneIpc((cmd, payload) =>
      cmd === 'changelog_image' ? releaseImageDataUriOf({ payload }) : undefined,
    );
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }
  return (
    <div className="flex flex-col gap-6 bg-background p-6 text-foreground">
      {RELEASE_IMAGE_CASES.map(({ id, image, title }) => (
        <div key={id} data-release-image-case={id}>
          <ReleaseImage
            version={RELEASE_IMAGE_VERSION}
            image={image}
            hasBefore={true}
            alt={title}
          />
        </div>
      ))}
    </div>
  );
};

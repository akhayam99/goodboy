import { useState } from 'react';
import { ScrollFade } from '@goodboy/ui';
import { ImageLightbox } from '../../../../../shared/components/ImageLightbox';

const PREVIEW_SRC = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400"/></svg>',
)}`;

const ROWS = Array.from({ length: 40 }, (_, index) => `Webhook retry ${index + 1} on payments-api`);

export const ImageLightboxScene = () => {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <main className="h-screen bg-background text-foreground">
      <ScrollFade className="h-full" viewportClassName="flex flex-col gap-3 p-6">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="w-fit rounded-md border border-border-soft px-3 py-1 text-meta"
        >
          Open preview
        </button>
        <ul className="flex flex-col gap-2 text-body">
          {ROWS.map((row) => (
            <li key={row}>{row}</li>
          ))}
        </ul>
      </ScrollFade>
      {isOpen ? (
        <ImageLightbox
          src={PREVIEW_SRC}
          alt="Harborline checkout preview"
          onClose={() => setIsOpen(false)}
        />
      ) : null}
    </main>
  );
};

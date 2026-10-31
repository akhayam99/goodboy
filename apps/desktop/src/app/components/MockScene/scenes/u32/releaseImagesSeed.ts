type Shot = {
  readonly image: string;
  readonly variant: 'before' | 'after';
  readonly width: number;
  readonly height: number;
  readonly hue: number;
};

export type ReleaseImageCase = {
  readonly id: string;
  readonly image: string;
  readonly title: string;
};

export const RELEASE_IMAGE_CASES: ReadonlyArray<ReleaseImageCase> = [
  { id: 'wide', image: 'wide-card', title: 'Acme question card' },
  { id: 'tall', image: 'tall-rail', title: 'Harborline rail' },
];

export const RELEASE_IMAGE_VERSION = '0.29.9';

const SHOTS: ReadonlyArray<Shot> = [
  { image: 'wide-card', variant: 'after', width: 1360, height: 568, hue: 210 },
  { image: 'wide-card', variant: 'before', width: 1360, height: 836, hue: 30 },
  { image: 'tall-rail', variant: 'after', width: 320, height: 552, hue: 150 },
  { image: 'tall-rail', variant: 'before', width: 320, height: 420, hue: 330 },
];

const EMPTY_PICTURE = 'data:image/png;base64,';

const drawPicture = ({ width, height, hue }: Shot): string => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (context === null) {
    return EMPTY_PICTURE;
  }
  const fill = context.createLinearGradient(0, 0, width, height);
  fill.addColorStop(0, `hsl(${hue} 60% 55%)`);
  fill.addColorStop(1, `hsl(${(hue + 60) % 360} 60% 30%)`);
  context.fillStyle = fill;
  context.fillRect(0, 0, width, height);
  context.strokeStyle = 'white';
  context.lineWidth = 8;
  context.strokeRect(4, 4, width - 8, height - 8);
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(width, height);
  context.moveTo(width, 0);
  context.lineTo(0, height);
  context.stroke();
  return canvas.toDataURL('image/png');
};

const drawn = new Map<string, string>();

type FileParams = {
  readonly payload: unknown;
};

export const releaseImageDataUriOf = ({ payload }: FileParams): string | undefined => {
  if (typeof payload !== 'object' || payload === null || !('file' in payload)) {
    return undefined;
  }
  const file = String(payload.file);
  const shot = SHOTS.find(
    ({ image, variant }) => file.startsWith(`${image}-${variant}-`) && file.endsWith('.webp'),
  );
  if (shot === undefined) {
    return undefined;
  }
  const key = `${shot.image}-${shot.variant}`;
  const cached = drawn.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const uri = drawPicture(shot);
  drawn.set(key, uri);
  return uri;
};

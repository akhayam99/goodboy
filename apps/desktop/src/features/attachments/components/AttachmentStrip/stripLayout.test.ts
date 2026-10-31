import { describe, expect, it } from 'vitest';
import { splitStripImages } from './stripLayout';

describe('splitStripImages', () => {
  it('fits six thumbnails of 48 px in the narrowest surface, the right drawer at its minimum', () => {
    expect(splitStripImages({ count: 6 })).toEqual({ shown: 6, hidden: 0 });
  });

  it('gives the last slot to the +N tile once there are more images than slots', () => {
    expect(splitStripImages({ count: 7 })).toEqual({ shown: 5, hidden: 2 });
    expect(splitStripImages({ count: 12 })).toEqual({ shown: 5, hidden: 7 });
  });

  it('shows nothing for no images', () => {
    expect(splitStripImages({ count: 0 })).toEqual({ shown: 0, hidden: 0 });
  });
});

import { forwardRef } from 'react';
import type { IconGlyph, IconGlyphProps } from '@goodboy/ui/icons';
import { useCurrentWorkspace } from '../../../../store';
import { WorkspaceTile } from '../WorkspaceSwitcher/WorkspaceTile';

export const WorkspaceTileGlyph: IconGlyph = forwardRef<SVGSVGElement, IconGlyphProps>(
  ({ className }, _ref) => {
    const workspace = useCurrentWorkspace();
    if (workspace === null || workspace === undefined) {
      return null;
    }
    return <WorkspaceTile workspace={workspace} className={className} />;
  },
);

WorkspaceTileGlyph.displayName = 'WorkspaceTileGlyph';

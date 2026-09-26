import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';
import { TYPE_ROLES } from './typeRoles';

const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      'bg-image': ['bg-hover', 'bg-selected'],
      'font-size': [{ text: [...TYPE_ROLES] }],
    },
  },
});

export const cn = (...inputs: ClassValue[]): string => {
  return merge(clsx(inputs));
};

import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

const merge = extendTailwindMerge({
  extend: { classGroups: { 'bg-image': ['bg-hover', 'bg-selected'] } },
});

export const cn = (...inputs: ClassValue[]): string => {
  return merge(clsx(inputs));
};

import type { ComponentType } from 'react';
import { FieldErrorScene } from './FieldErrorScene';
import { PopoverLongMenuScene } from './PopoverLongMenuScene';

export const U49_RULES_SCENES: Readonly<Record<string, ComponentType>> = {
  'field-error': FieldErrorScene,
  'popover-long-menu': PopoverLongMenuScene,
};

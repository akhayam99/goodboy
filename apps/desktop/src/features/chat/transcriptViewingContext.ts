import { createContext } from 'react';
import type { ActionViewing } from '../actions/types';

export const TranscriptViewingContext = createContext<ActionViewing | null>(null);

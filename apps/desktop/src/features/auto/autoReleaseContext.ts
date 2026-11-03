import { createContext } from 'react';
import { AUTO_GATES } from '@goodboy/core/auto';

export const AutoReleaseContext = createContext<boolean>(AUTO_GATES.isDelegationEnabled);

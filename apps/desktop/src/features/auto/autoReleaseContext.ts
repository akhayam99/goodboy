import { createContext } from 'react';
import { AUTO_GATES } from '@goodboy/core';

export const AutoReleaseContext = createContext<boolean>(AUTO_GATES.isDelegationEnabled);

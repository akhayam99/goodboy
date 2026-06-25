export const MAX_SESSION_TITLE_LENGTH = 60;

export const clampTitle = (s: string) => s.trim().slice(0, MAX_SESSION_TITLE_LENGTH);

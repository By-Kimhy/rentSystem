// Photos are stored and served by the API; /api/* is proxied to it (see next.config.ts).
export function photoUrl(fileName: string) {
  return `/api/photos/${fileName}`;
}

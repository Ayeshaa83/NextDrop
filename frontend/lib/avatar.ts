// Neutral "no profile picture yet" placeholder for artists who haven't
// uploaded one. Deliberately a plain silhouette rather than a stock photo —
// several places used to fall back to real seed artists' actual photos
// (e.g. Axion's / Luna Sol's), which made a profile-less artist look like
// a specific other artist instead of visibly "no photo set."
export const DEFAULT_AVATAR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%231e293b'/%3E%3Ccircle cx='100' cy='78' r='38' fill='%2364748b'/%3E%3Cpath d='M100 128c-48 0-72 26-72 58v14h144v-14c0-32-24-58-72-58z' fill='%2364748b'/%3E%3C/svg%3E";

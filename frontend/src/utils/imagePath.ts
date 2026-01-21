/**
 * Helper function to get image paths that work with Vite's base path
 * @param path - Image path relative to public folder (e.g., "images/logo.png")
 * @returns Full path with base URL prepended
 */
export const getImagePath = (path: string): string => {
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  // Vite's BASE_URL already includes trailing slash when set
  const baseUrl = import.meta.env.BASE_URL || '/';
  return `${baseUrl}${cleanPath}`;
};

/**
 * Helper function to get CSS backgroundImage URL that works with Vite's base path
 * @param path - Image path relative to public folder (e.g., "images/bg.png")
 * @returns CSS url() string with base URL prepended
 */
export const getBackgroundImageUrl = (path: string): string => {
  return `url(${getImagePath(path)})`;
};

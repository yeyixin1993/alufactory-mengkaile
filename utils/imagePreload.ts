const retainedImages = new Map<string, HTMLImageElement>();

/**
 * Starts downloading an image and keeps the element alive after it has been
 * decoded. Reusing the same URL from a visible <img> can then use the browser's
 * network and decoded-image caches instead of waiting after a color switch.
 */
export const preloadImage = (src: string) => {
  if (typeof Image === 'undefined' || retainedImages.has(src)) return;

  const image = new Image();
  image.decoding = 'async';
  image.loading = 'eager';
  retainedImages.set(src, image);

  image.addEventListener('load', () => {
    if (typeof image.decode === 'function') {
      void image.decode().catch(() => {
        // The image is still available from the normal browser cache when a
        // browser cannot retain a separately decoded bitmap.
      });
    }
  }, { once: true });
  image.addEventListener('error', () => {
    // Allow a later page visit to retry a transiently unavailable asset.
    retainedImages.delete(src);
  }, { once: true });
  image.src = src;
};

export const preloadImages = (sources: Iterable<string>) => {
  for (const src of sources) preloadImage(src);
};

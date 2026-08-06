# PWA icons

Drop `icon-192.png` and `icon-512.png` (and a maskable 512 variant) here
before shipping. Modern browsers can also accept `icon.svg` directly.

You can generate them from `icon.svg` with any tool, e.g.:

    npx pwa-asset-generator public/icons/icon.svg public/icons \
      --background "#0b0c0f" --padding 0

The dev server runs fine without them; the PWA install prompt just won't
appear until they're present.

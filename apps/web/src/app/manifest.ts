import type { MetadataRoute } from 'next';

// M6-04: lets Android Chrome and iOS Safari add FitSphere to the home screen. Offline mode is cut (decision-m6-launch).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FitSphere',
    short_name: 'FitSphere',
    description: 'Coach-led boxing, strength and gym training.',
    start_url: '/today',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#111111',
    icons: [
      { src: '/pwa-icon/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

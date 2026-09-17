import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'co.in.hicon.install',
  appName: 'HICON Insta & Serv',
  // Points the native WebView at the live production site rather than
  // bundling a local copy — this app relies on server-rendered pages,
  // API routes, and a database, none of which can be a static export.
  webDir: 'public',
  server: {
    url: 'https://install.hicon.co.in',
    androidScheme: 'https',
  },
};

export default config;

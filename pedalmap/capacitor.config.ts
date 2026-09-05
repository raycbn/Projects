import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pedalmap.app',
  appName: 'PedalMap',
  webDir: 'dist',
  server: process.env.CAPACITOR_DEV_SERVER === '1'
    ? {
        url: 'http://10.0.2.2:5173',
        cleartext: true,
      }
    : undefined,
  android: {
    allowNavigation: ['localhost', '127.0.0.1', '10.0.2.2'],
  },
};

export default config;

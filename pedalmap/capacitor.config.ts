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
  plugins: {
    SplashScreen: {
      // Keep the native splash until the web app signals it is painted/ready,
      // so there is never a white flash between the splash and first frame.
      launchShow: true,
      launchAutoHide: false,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#0d3b2b',
    },
  },
};

export default config;

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.crmvere.app',
  appName: 'CRM do Vere',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;

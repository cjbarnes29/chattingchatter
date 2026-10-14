import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'app.chatter.messenger',
  appName: 'Chatter',
  webDir: 'dist',
  android: {
    backgroundColor: '#F6F1E8',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#F6F1E8',
      showSpinner: false,
    },
  },
}

export default config

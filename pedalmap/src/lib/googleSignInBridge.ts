import { Capacitor } from '@capacitor/core'

declare module '@capacitor/core' {
  interface PluginRegistry {
    GoogleSignIn?: {
      signIn(options: { clientId: string }): Promise<{
        uid: string | null
        email: string | null
        displayName: string | null
        photoURL: string | null
        provider: string
      }>
    }
  }
}

export async function nativeGoogleSignIn(clientId: string): Promise<{
  uid: string | null
  email: string | null
  displayName: string | null
  photoURL: string | null
  provider: string
  idToken: string | null
}> {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('nativeGoogleSignIn called on web')
  }
  const plugin = (Capacitor as any).Plugins?.GoogleSignIn
  if (!plugin) {
    throw new Error('GoogleSignIn plugin not available')
  }
  return plugin.signIn({ clientId })
}

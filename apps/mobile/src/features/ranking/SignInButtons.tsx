import { StyleSheet, View } from 'react-native'
import * as AppleAuthentication from 'expo-apple-authentication'
import { useTranslation } from 'react-i18next'
import type { OAuthProvider } from '../../lib/sync'
import { useSession, useToast } from '../../providers'
import { Button, radius, sizes, space } from '../../ui'

/* Native sign-in, offered on the Ranking tab and the Profile: Google as the
   app's primary button and, on iOS, the system Sign in with Apple button
   (App Store rules ask for the real control). Each shows only when the
   build offers it (src/config.ts). A closed dialog is nothing, a failure
   is a toast, a success lets the caller refresh what depends on the
   account. */

export function SignInButtons({ onSignedIn }: { onSignedIn?: () => void }) {
  const { t } = useTranslation()
  const account = useSession()
  const toast = useToast()

  async function signIn(provider: OAuthProvider) {
    if (account.busy) return
    const outcome = await account.signIn(provider)
    if (outcome === 'failed') toast.show({ tone: 'error', text: t('mobile:ranking.signInFailed') })
    else if (outcome === 'ok') onSignedIn?.()
  }

  return (
    <View style={styles.buttons}>
      {account.providers.includes('google') ? (
        <Button variant="primary" block busy={account.busy} onPress={() => void signIn('google')}>
          {t('ranking.signInGoogle')}
        </Button>
      ) : null}
      {account.providers.includes('apple') ? (
        <View
          pointerEvents={account.busy ? 'none' : 'auto'}
          accessibilityElementsHidden={account.busy}
          importantForAccessibility={account.busy ? 'no-hide-descendants' : 'auto'}
          style={account.busy && styles.busy}
        >
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE}
            cornerRadius={radius.control}
            style={styles.apple}
            accessibilityLabel={t('ranking.signInApple')}
            onPress={() => void signIn('apple')}
          />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  buttons: {
    gap: space.sm,
  },
  apple: {
    height: sizes.button,
    width: '100%',
  },
  busy: {
    opacity: 0.7,
  },
})

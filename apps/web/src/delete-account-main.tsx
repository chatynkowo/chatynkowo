import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './ui/ui.css'
import './i18n'
import './delete-account.css'
import { AccountProvider } from './providers/AccountProvider'
import { DeleteAccountApp } from './DeleteAccountApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AccountProvider>
      <DeleteAccountApp />
    </AccountProvider>
  </StrictMode>,
)

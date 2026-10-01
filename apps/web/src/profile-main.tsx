import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './ui/ui.css'
import './i18n'
import './profile.css'
import { AccountProvider } from './providers/AccountProvider'
import { ProfileApp } from './ProfileApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AccountProvider>
      <ProfileApp />
    </AccountProvider>
  </StrictMode>,
)

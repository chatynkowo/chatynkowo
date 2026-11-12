import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './ui/ui.css'
import './i18n'
import './diagnostics.css'
import { AccountProvider } from './providers/AccountProvider'
import { DiagnosticsApp } from './DiagnosticsApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AccountProvider>
      <DiagnosticsApp />
    </AccountProvider>
  </StrictMode>,
)

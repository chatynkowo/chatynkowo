import { createRoot } from 'react-dom/client'
import './ui/ui.css'
import './i18n'
import { RankingApp } from './RankingApp'

createRoot(document.getElementById('root')!).render(<RankingApp />)

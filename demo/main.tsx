import { createRoot } from 'react-dom/client'
import { MigraineLab } from '../src/react/index.js'
import '../src/react/styles.css'
import './page.css'

createRoot(document.getElementById('root')!).render(
  <main>
    <header>
      <h1>Migraine Lab<span>.</span></h1>
      <p>Watch a migraine unfold from visual aura to drug binding, then compare treated and untreated recovery.</p>
    </header>
    <MigraineLab />
  </main>,
)

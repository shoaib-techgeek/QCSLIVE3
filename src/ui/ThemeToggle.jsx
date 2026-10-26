import Icon from './Icon.jsx'
import { THEMES, useTheme } from './theme.js'

const ICON = { system: 'monitor', light: 'sun', dark: 'moon' }
const LABEL = { system: 'Match system theme', light: 'Light theme', dark: 'Dark theme' }

export default function ThemeToggle() {
  const [theme, setTheme] = useTheme()
  return (
    <div className="theme-toggle" role="group" aria-label="Colour theme">
      {THEMES.map((t) => (
        <button key={t} type="button" aria-pressed={theme === t} aria-label={LABEL[t]} title={LABEL[t]} onClick={() => setTheme(t)}>
          <Icon name={ICON[t]} size={16} />
        </button>
      ))}
    </div>
  )
}

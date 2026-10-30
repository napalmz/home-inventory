import { version as frontendVersion } from '../../package.json';
import { ReactNode, useState, useEffect } from 'react'
import { Link, NavLink } from 'react-router-dom'
import GlobalBarcodeScan from '../components/GlobalBarcodeScan'
import { useAuth } from '../useAuth'
import { getApiVersion } from '../api'
import { FiLogOut, FiCompass, FiBox, FiCheckSquare, FiSettings, FiLogIn, FiUser, FiSun, FiMoon, FiMonitor, FiInfo, FiMenu, FiX } from 'react-icons/fi'

type ThemeMode = 'light' | 'dark' | 'system'

const THEME_STORAGE_KEY = 'theme-mode'

function getStoredTheme(): ThemeMode {
  const stored = localStorage.getItem(THEME_STORAGE_KEY)
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
}

interface SidebarLayoutProps {
  children: ReactNode
}

export default function SidebarLayout({ children }: SidebarLayoutProps) {
  const [isOpen, setIsOpen] = useState(window.innerWidth >= 768)
  const [apiVersion, setApiVersion] = useState<string | null>(null)
  const [themeMode, setThemeMode] = useState<ThemeMode>(getStoredTheme)

  const auth = useAuth()
  const { logout } = auth
  const user = auth.user ?? null

  useEffect(() => {
    getApiVersion()
      .then((data) => setApiVersion(data.version))
      .catch(() => setApiVersion(null))
  }, [])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const updateTheme = () => {
      const isDark = themeMode === 'dark' || (themeMode === 'system' && mediaQuery.matches)
      document.documentElement.classList.toggle('dark', isDark)
      document.documentElement.style.colorScheme = isDark ? 'dark' : 'light'
    }

    localStorage.setItem(THEME_STORAGE_KEY, themeMode)
    updateTheme()
    if (themeMode === 'system') {
      mediaQuery.addEventListener('change', updateTheme)
      return () => mediaQuery.removeEventListener('change', updateTheme)
    }
  }, [themeMode])

  const toggleSidebar = () => setIsOpen(!isOpen)
  const themeModes: ThemeMode[] = ['light', 'dark', 'system']
  const themeLabels: Record<ThemeMode, string> = {
    light: 'Chiaro',
    dark: 'Scuro',
    system: 'Sistema',
  }
  const themeIcons = {
    light: FiSun,
    dark: FiMoon,
    system: FiMonitor,
  }
  const ThemeIcon = themeIcons[themeMode]
  const nextTheme = themeLabels[themeModes[(themeModes.indexOf(themeMode) + 1) % themeModes.length]]

  return (
    <div className="flex h-screen overflow-hidden">
      {!isOpen && (
        <div className="md:hidden fixed top-4 left-4 z-50 dark:text-white">
          <button
            onClick={toggleSidebar}
            aria-label="Apri menu navigation"
            aria-expanded={isOpen}
            className="p-2 rounded-lg bg-gray-800 text-white shadow-md hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <FiMenu className="text-xl" />
          </button>
        </div>
      )}
      {/* Sidebar */}
      <div
        className={`bg-gray-800 text-white dark:bg-gray-800 dark:text-gray-300 w-64 p-4 transition-transform duration-300 transform ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 md:relative fixed z-40 top-0 bottom-0 h-screen`}
      >
        <div className="flex justify-between items-center mb-4 md:hidden">
          <span className="font-bold text-lg">Menu</span>
          <button
            onClick={toggleSidebar}
            aria-label="Chiudi menu navigation"
            aria-expanded={isOpen}
            className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <FiX className="text-xl" />
          </button>
        </div>

        {user && user.username ? (
          <div className="mb-6">
            <p className="font-semibold capitalize">Ciao, {user.username}</p>
            <p className="text-sm capitalize text-gray-300">{user.role.name}</p>
            <Link to="/profile" className="text-blue-300 text-sm block mt-1" onClick={() => window.innerWidth < 768 && toggleSidebar()}>
              <span className="flex items-center gap-2"><FiUser className="shrink-0"/>Gestione profilo</span>
            </Link>
            <button
              onClick={() => {
                logout()
                  .then(() => {
                    window.location.href = '/'
                  })
                  .catch(() => {
                    window.location.href = '/'
                  })
              }}
              className="text-red-400 text-sm mt-1 block text-left flex items-center gap-1"
            >
              <FiLogOut className="inline" />
              <span>Logout</span>
            </button>
          </div>
        ) : (
          <Link to="/login" className="block text-blue-300 mb-4" onClick={() => window.innerWidth < 768 && toggleSidebar()}>
            <span className="flex items-center gap-2"><FiLogIn className="shrink-0"/>Login / Registrazione</span>
          </Link>
        )}

        <nav className="space-y-2">
          <NavLink
            to="/"
            onClick={() => window.innerWidth < 768 && toggleSidebar()}
            className={({ isActive }) =>
              `flex items-center gap-3 hover:text-blue-300 ` +
              (isActive
                ? 'bg-gradient-to-r from-blue-500 to-blue-700 text-white rounded-xl px-4 py-3'
                : 'px-4 py-3')
            }
          >
            <FiCompass className="text-lg shrink-0" />
            <span>Home</span>
          </NavLink>
          {user && user.username && (
            <NavLink
              to="/inventories"
              onClick={() => window.innerWidth < 768 && toggleSidebar()}
              className={({ isActive }) =>
                `flex items-center gap-3 hover:text-blue-300 ` +
                (isActive
                  ? 'bg-gradient-to-r from-blue-500 to-blue-700 text-white rounded-xl px-4 py-3'
                  : 'px-4 py-3')
              }
            >
              <FiBox className="text-lg shrink-0" />
              <span>Inventari</span>
            </NavLink>
          )}
          {user && user.username && (
            <NavLink
              to="/checklists"
              onClick={() => window.innerWidth < 768 && toggleSidebar()}
              className={({ isActive }) =>
                `flex items-center gap-3 hover:text-blue-300 ` +
                (isActive
                  ? 'bg-gradient-to-r from-blue-500 to-blue-700 text-white rounded-xl px-4 py-3'
                  : 'px-4 py-3')
              }
            >
              <FiCheckSquare className="text-lg shrink-0" />
              <span>Liste</span>
            </NavLink>
          )}
          {user && user.username && user.role?.name === 'admin' && (
            <NavLink
              to="/settings"
              onClick={() => window.innerWidth < 768 && toggleSidebar()}
              className={({ isActive }) =>
                `flex items-center gap-3 hover:text-blue-300 ` +
                (isActive
                  ? 'bg-gradient-to-r from-blue-500 to-blue-700 text-white rounded-xl px-4 py-3'
                  : 'px-4 py-3')
              }
            >
              <FiSettings className="text-lg shrink-0" />
              <span>Impostazioni</span>
            </NavLink>
          )}
          <NavLink
            to="/about"
            onClick={() => window.innerWidth < 768 && toggleSidebar()}
            className={({ isActive }) =>
              `flex items-center gap-3 hover:text-blue-300 ` +
              (isActive
                ? 'bg-gradient-to-r from-blue-500 to-blue-700 text-white rounded-xl px-4 py-3'
                : 'px-4 py-3')
            }
          >
            <FiInfo className="text-lg shrink-0" />
            <span>About</span>
          </NavLink>
        </nav>

        <div className="mt-6 border-t border-gray-600 pt-4">
          <button
            type="button"
            onClick={() => setThemeMode(themeModes[(themeModes.indexOf(themeMode) + 1) % themeModes.length])}
            aria-label={`Tema ${themeLabels[themeMode]}. Passa a ${nextTheme}`}
            title={`Tema: ${themeLabels[themeMode]} · clicca per ${nextTheme.toLowerCase()}`}
            className="flex w-full items-center justify-center rounded-lg px-4 py-3 text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
          >
            <ThemeIcon className="text-xl" aria-hidden="true" />
          </button>
        </div>

        {/* Footer */}
        <div className="absolute bottom-4 left-4 right-4 text-xs text-gray-400">
          <hr className="mb-2 border-gray-600" />
          <p>API v{apiVersion ?? '...'}</p>
          <p>Frontend v{frontendVersion}</p>
          <p className="mt-1">
            © 2025-{new Date().getFullYear()} <a href="https://github.com/napalmz" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">napalmz</a>
          </p>
        </div>

      </div>
      {isOpen && window.innerWidth < 768 && (
        <div
          className="fixed inset-0 z-30"
          onClick={toggleSidebar}
        />
      )}

      {/* Contenuto */}
      <div className="flex-1 p-6 ml-0 w-full overflow-auto dark:bg-gray-900 dark:text-white">{children}</div>
      <GlobalBarcodeScan />
    </div>
  )
}

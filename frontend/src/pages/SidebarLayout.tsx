import { version as frontendVersion } from '../../package.json';
import { ReactNode, useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../useAuth'
import { getApiVersion } from '../api'
import { User } from "../types"
import { FiLogOut } from 'react-icons/fi'

interface SidebarLayoutProps {
  children: ReactNode
}

export default function SidebarLayout({ children }: SidebarLayoutProps) {
  const [isOpen, setIsOpen] = useState(window.innerWidth >= 768)
  const [user, setUser] = useState<User | null>(null)
  const [apiVersion, setApiVersion] = useState<string | null>(null)
  const navigate = useNavigate()

  const auth = useAuth()

  const { logout } = useAuth()

  useEffect(() => {
    setUser(auth.user ?? null)
  }, [auth.user])

  useEffect(() => {
    getApiVersion()
      .then((data) => setApiVersion(data.version))
      .catch(() => setApiVersion(null))
  }, [])

  const toggleSidebar = () => setIsOpen(!isOpen)

  return (
    <div className="flex h-screen overflow-hidden">
      {!isOpen && (
        <div className="md:hidden fixed top-4 left-4 z-50">
          <button onClick={toggleSidebar}>☰</button>
        </div>
      )}
      {/* Sidebar */}
      <div
        className={`bg-gray-800 text-white w-64 p-4 transition-transform duration-300 transform ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 md:relative fixed z-40 top-0 bottom-0 h-screen`}
      >
        <div className="flex justify-between items-center mb-4 md:hidden">
          <span className="font-bold text-lg">Menu</span>
          <button onClick={toggleSidebar}>☰</button>
        </div>

        {user && user.username ? (
          <div className="mb-6">
            <p className="font-semibold capitalize">Ciao, {user.username}</p>
            <p className="text-sm capitalize text-gray-300">{user.role.name}</p>
            <Link to="/profile" className="text-blue-300 text-sm block mt-1" onClick={() => window.innerWidth < 768 && toggleSidebar()}>
              Gestione profilo
            </Link>
            <button
              onClick={() => {
                logout()
                  .then(() => {
                    setUser(null)
                    navigate('/')
                  })
                  .catch(() => {
                    setUser(null)
                    navigate('/')
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
            Login / Registrazione
          </Link>
        )}

        <nav className="space-y-2">
          {user && user.username && (
            <Link to="/inventories" className="block hover:text-blue-300" onClick={() => window.innerWidth < 768 && toggleSidebar()}>
              Inventari
            </Link>
          )}
          {user && user.username && user.role?.name === 'admin' && (
            <Link to="/settings" className="block hover:text-blue-300" onClick={() => window.innerWidth < 768 && toggleSidebar()}>
              Impostazioni
            </Link>
          )}
        </nav>

        {/* Footer */}
        <div className="absolute bottom-4 left-4 right-4 text-xs text-gray-400">
          <hr className="mb-2 border-gray-600" />
          <p>API v{apiVersion ?? '...'}</p>
          <p>Frontend v{frontendVersion}</p>
          <p className="mt-1">
            © {new Date().getFullYear()} <a href="https://github.com/napalmz" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">napalmz</a>
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
      <div className="flex-1 p-6 ml-0 w-full overflow-auto">{children}</div>
    </div>
  )
}
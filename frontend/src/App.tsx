import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import ProtectedRoute from "./pages/ProtectedRoute"
import SidebarLayout from './pages/SidebarLayout'
import WelcomePage from './pages/WelcomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ProfilePage from './pages/ProfilePage'
import InventoryListPage from './pages/InventoryListPage'
import SettingsPage from './pages/SettingsPage'
import InventoryDetailPage from './pages/InventoryDetailPage'

function App() {
  return (
    <Router>
      <Routes>
        <Route element={<SidebarLayout><Outlet /></SidebarLayout>}>
          <Route path="/" element={<WelcomePage />} />
          <Route path="/inventories" element={
            <ProtectedRoute>
              <InventoryListPage />
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute requireAdmin={true}>
              <SettingsPage />
            </ProtectedRoute>
          } />
          {/* Aggiungi qui eventuali altre rotte visibili nel layout*/}
          <Route path="/inventories/:id" element={<InventoryDetailPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  )
}

export default App

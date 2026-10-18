import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { StudentsProvider } from './context/StudentsContext'
import { PublicOnly, RequireAuth } from './components/RouteGuards'
import AdminLayout from './layouts/AdminLayout'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import Dashboard from './pages/admin/Dashboard'
import Applications from './pages/admin/Applications'
import Students from './pages/admin/Students'
import Portal from './pages/Portal'
import './pages/pages.css'

function NotFound() {
  return (
    <main className="notfound">
      <h1>Page not found</h1>
      <Link className="btn btn--primary" to="/">
        Go home
      </Link>
    </main>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <StudentsProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/admin" replace />} />

            <Route element={<PublicOnly />}>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
            </Route>

            <Route element={<RequireAuth role="admin" />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="applications" element={<Applications />} />
                <Route path="students" element={<Students />} />
              </Route>
            </Route>

            <Route element={<RequireAuth role="student" />}>
              <Route path="/portal" element={<Portal />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </StudentsProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

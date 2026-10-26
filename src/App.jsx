import { Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext.jsx'
import RequireAuth from './auth/RequireAuth.jsx'
import RequirePermission from './auth/RequirePermission.jsx'
import ConsoleLayout from './components/ConsoleLayout.jsx'
import Layout from './components/Layout.jsx'
import AccountPage from './pages/AccountPage.jsx'
import DesignPage from './pages/DesignPage.jsx'
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx'
import HomePage from './pages/HomePage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import ResetPasswordPage from './pages/ResetPasswordPage.jsx'
import VerifyEmailPage from './pages/VerifyEmailPage.jsx'
import AdminDashboardPage from './pages/admin/AdminDashboardPage.jsx'
import SellerDashboardPage from './pages/seller/SellerDashboardPage.jsx'
import { ToastProvider } from './ui/Toast.jsx'

const SELLER_NAV = [
  { to: '/seller', label: 'Dashboard', icon: 'home', end: true },
]
const ADMIN_NAV = [
  { to: '/admin', label: 'Overview', icon: 'home', end: true },
]

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route path="verify-email" element={<VerifyEmailPage />} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
            <Route path="reset-password" element={<ResetPasswordPage />} />
            {import.meta.env.DEV && <Route path="design" element={<DesignPage />} />}
            <Route element={<RequireAuth />}>
              <Route path="account" element={<AccountPage />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          <Route element={<RequireAuth />}>
            <Route element={<RequirePermission permission="seller:access" />}>
              <Route path="seller" element={<ConsoleLayout title="Seller center" nav={SELLER_NAV} />}>
                <Route index element={<SellerDashboardPage />} />
              </Route>
            </Route>
            <Route element={<RequirePermission permission="admin:access" />}>
              <Route path="admin" element={<ConsoleLayout title="Admin console" nav={ADMIN_NAV} />}>
                <Route index element={<AdminDashboardPage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </ToastProvider>
    </AuthProvider>
  )
}

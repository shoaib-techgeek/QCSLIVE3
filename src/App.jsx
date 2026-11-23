import { Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext.jsx'
import { CartProvider } from './cart/CartContext.jsx'
import RequireAuth from './auth/RequireAuth.jsx'
import RequirePermission from './auth/RequirePermission.jsx'
import ConsoleLayout from './components/ConsoleLayout.jsx'
import Layout from './components/Layout.jsx'
import AccountPage from './pages/AccountPage.jsx'
import CartPage from './pages/CartPage.jsx'
import DesignPage from './pages/DesignPage.jsx'
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx'
import HomePage from './pages/HomePage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import ProductPage from './pages/ProductPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import ResetPasswordPage from './pages/ResetPasswordPage.jsx'
import SearchPage from './pages/SearchPage.jsx'
import VerifyEmailPage from './pages/VerifyEmailPage.jsx'
import AdminDashboardPage from './pages/admin/AdminDashboardPage.jsx'
import KycQueuePage from './pages/admin/KycQueuePage.jsx'
import ProductQueuePage from './pages/admin/ProductQueuePage.jsx'
import ProductReviewPage from './pages/admin/ProductReviewPage.jsx'
import KycReviewPage from './pages/admin/KycReviewPage.jsx'
import OnboardingPage from './pages/seller/OnboardingPage.jsx'
import SellerDashboardPage from './pages/seller/SellerDashboardPage.jsx'
import SellerProductEditPage from './pages/seller/SellerProductEditPage.jsx'
import SellerProductFormPage from './pages/seller/SellerProductFormPage.jsx'
import SellerProductsPage from './pages/seller/SellerProductsPage.jsx'
import { ToastProvider } from './ui/Toast.jsx'

const SELLER_NAV = [
  { to: '/seller', label: 'Dashboard', icon: 'home', end: true },
  { to: '/seller/products', label: 'Products', icon: 'box' },
]
const ADMIN_NAV = [
  { to: '/admin', label: 'Overview', icon: 'home', end: true },
  { to: '/admin/kyc', label: 'Seller verification', icon: 'shield' },
  { to: '/admin/products', label: 'Product review', icon: 'box' },
]

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
      <ToastProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="p/:slug" element={<ProductPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route path="verify-email" element={<VerifyEmailPage />} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
            <Route path="reset-password" element={<ResetPasswordPage />} />
            {import.meta.env.DEV && <Route path="design" element={<DesignPage />} />}
            <Route element={<RequireAuth />}>
              <Route path="account" element={<AccountPage />} />
              <Route path="cart" element={<CartPage />} />
              <Route path="seller/onboarding" element={<OnboardingPage />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          <Route element={<RequireAuth />}>
            <Route element={<RequirePermission permission="seller:access" />}>
              <Route path="seller" element={<ConsoleLayout title="Seller center" nav={SELLER_NAV} />}>
                <Route index element={<SellerDashboardPage />} />
                <Route path="products" element={<SellerProductsPage />} />
                <Route path="products/new" element={<SellerProductFormPage />} />
                <Route path="products/:productId" element={<SellerProductEditPage />} />
              </Route>
            </Route>
            <Route element={<RequirePermission permission="admin:access" />}>
              <Route path="admin" element={<ConsoleLayout title="Admin Dashboard" nav={ADMIN_NAV} />}>
                <Route index element={<AdminDashboardPage />} />
                <Route element={<RequirePermission permission="product:moderate" />}>
                  <Route path="products" element={<ProductQueuePage />} />
                  <Route path="products/:productId" element={<ProductReviewPage />} />
                </Route>
                <Route element={<RequirePermission permission="kyc:review" />}>
                  <Route path="kyc" element={<KycQueuePage />} />
                  <Route path="kyc/:sellerId" element={<KycReviewPage />} />
                </Route>
              </Route>
            </Route>
          </Route>
        </Routes>
      </ToastProvider>
      </CartProvider>
    </AuthProvider>
  )
}

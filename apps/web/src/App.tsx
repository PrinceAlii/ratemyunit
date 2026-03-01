import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider } from './lib/auth-context';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingSpinner } from './components/ui/loading-spinner';

const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })));
const Register = lazy(() => import('./pages/Register').then((m) => ({ default: m.Register })));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword').then((m) => ({ default: m.ForgotPassword })));
const ResetPassword = lazy(() => import('./pages/ResetPassword').then((m) => ({ default: m.ResetPassword })));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail').then((m) => ({ default: m.VerifyEmail })));
const HomePage = lazy(() => import('./pages/Home').then((m) => ({ default: m.HomePage })));
const UnitDetails = lazy(() => import('./pages/UnitDetails').then((m) => ({ default: m.UnitDetails })));
const BrowsePage = lazy(() => import('./pages/Browse').then((m) => ({ default: m.BrowsePage })));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy').then((m) => ({ default: m.PrivacyPolicy })));
const TermsOfUse = lazy(() => import('./pages/TermsOfUse').then((m) => ({ default: m.TermsOfUse })));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard').then((m) => ({ default: m.AdminDashboard })));
const NotFound = lazy(() => import('./pages/NotFound').then((m) => ({ default: m.NotFound })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <LoadingSpinner />
  </div>
);

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route element={<Layout />}>
                  <Route path="/" element={<ErrorBoundary><HomePage /></ErrorBoundary>} />
                  <Route path="/browse" element={<ErrorBoundary><BrowsePage /></ErrorBoundary>} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/verify-email" element={<VerifyEmail />} />
                  <Route path="/units/:unitId" element={<ErrorBoundary><UnitDetails /></ErrorBoundary>} />
                  <Route path="/privacy" element={<ErrorBoundary><PrivacyPolicy /></ErrorBoundary>} />
                  <Route path="/terms" element={<ErrorBoundary><TermsOfUse /></ErrorBoundary>} />
                  <Route
                    path="/admin"
                    element={
                      <ProtectedRoute requireAdmin>
                        <ErrorBoundary>
                          <AdminDashboard />
                        </ErrorBoundary>
                      </ProtectedRoute>
                    }
                  />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </Suspense>
          </BrowserRouter>
          <Toaster
            richColors
            closeButton
            position="top-center"
            duration={4500}
            gap={12}
            offset={20}
            mobileOffset={12}
            className="neo-toaster"
            toastOptions={{
              classNames: {
                toast: 'neo-toast',
                title: 'neo-toast-title',
                description: 'neo-toast-description',
                actionButton: 'neo-toast-action',
                cancelButton: 'neo-toast-cancel',
                closeButton: 'neo-toast-close',
                success: 'neo-toast-success',
                error: 'neo-toast-error',
                warning: 'neo-toast-warning',
                info: 'neo-toast-info',
                loading: 'neo-toast-loading',
                default: 'neo-toast-default',
              },
            }}
          />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;

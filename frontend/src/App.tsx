import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { RoleGuard } from './components/guards/RoleGuard';
import { HomeMarketplace } from './pages/HomeMarketplace';
import { AuthPage } from './pages/AuthPage';
import { PropertyDetailPage } from './pages/PropertyDetailPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { MyReservationsPage } from './pages/MyReservationsPage';
import { ProfilePage } from './pages/ProfilePage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { SuperadminDashboardPage } from './pages/SuperadminDashboardPage';

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <div className="flex min-h-screen flex-col bg-brand-bg text-brand-text transition-colors duration-200">
              <Navbar />
              <main className="flex-1">
                <Routes>
                  {/* Public & Marketplace Routes */}
                  <Route path="/" element={<HomeMarketplace />} />
                  <Route path="/login" element={<AuthPage mode="login" />} />
                  <Route path="/registro" element={<AuthPage mode="register" />} />
                  <Route path="/alojamientos/:id" element={<PropertyDetailPage />} />

                  {/* Authenticated User Routes (CLIENTE, ADMIN, SUPERADMIN) */}
                  <Route
                    path="/checkout"
                    element={
                      <RoleGuard allowedRoles={['CLIENTE', 'ADMIN', 'SUPERADMIN']}>
                        <CheckoutPage />
                      </RoleGuard>
                    }
                  />
                  <Route
                    path="/mis-reservas"
                    element={
                      <RoleGuard allowedRoles={['CLIENTE', 'ADMIN', 'SUPERADMIN']}>
                        <MyReservationsPage />
                      </RoleGuard>
                    }
                  />
                  <Route
                    path="/perfil"
                    element={
                      <RoleGuard allowedRoles={['CLIENTE', 'ADMIN', 'SUPERADMIN']}>
                        <ProfilePage />
                      </RoleGuard>
                    }
                  />

                  {/* Host Management Routes (ADMIN & SUPERADMIN) */}
                  <Route
                    path="/admin"
                    element={
                      <RoleGuard allowedRoles={['ADMIN', 'SUPERADMIN']}>
                        <AdminDashboardPage />
                      </RoleGuard>
                    }
                  />

                  {/* Platform Governance & Master Catalogs (SUPERADMIN Only) */}
                  <Route
                    path="/superadmin"
                    element={
                      <RoleGuard allowedRoles={['SUPERADMIN']}>
                        <SuperadminDashboardPage />
                      </RoleGuard>
                    }
                  />

                  {/* Fallback */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
              <Footer />
            </div>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;

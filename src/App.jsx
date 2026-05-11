import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import DashboardLayout from './layouts/DashboardLayout';
import { InventoryProvider } from './context/InventoryContext';
import { SalesProvider } from './context/SalesContext';
import ProductList from './pages/inventory/ProductList';
import POS from './pages/sales/POS';
import Dashboard from './pages/Dashboard';
import Reports from './pages/reports/Reports';
import Quotes from './pages/sales/Quotes';
import Expenses from './pages/finance/Expenses';
import Replenishment from './pages/inventory/Replenishment';
import Movements from './pages/inventory/Movements';
import { PurchaseProvider } from './context/PurchaseContext';

import DebtBook from './pages/sales/DebtBook';
import Deliveries from './pages/sales/Deliveries';

import { SettingsProvider } from './context/SettingsContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import CompanyProfile from './pages/settings/CompanyProfile';
import UsersManagement from './pages/settings/UsersManagement';
import RolesPermissions from './pages/settings/RolesPermissions';
import Suppliers from './pages/finance/Suppliers';
import Sessions from './pages/sales/Sessions';
import { SessionProvider } from './context/SessionContext';

// Composant "Barrage" pour protéger les routes
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  
  // Affiche un écran de chargement le temps de vérifier le token
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#e8eef4]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#018f8f] border-t-transparent"></div>
      </div>
    );
  }
  
  // Redirige vers le Login si non authentifié
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

// Séparation des routes pour utiliser le Hook useAuth() à l'intérieur du Provider
const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      
      {/* Toutes ces routes sont protégées par le barrage */}
      <Route path="/" element={
        <ProtectedRoute>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Dashboard />} />
        <Route path="pos" element={<POS />} />
        <Route path="sessions" element={<Sessions />} />
        <Route path="inventory" element={<ProductList />} />
        <Route path="inventory/movements" element={<Movements />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="replenishment" element={<Replenishment />} />
        <Route path="reports" element={<Reports />} />
        <Route path="quotes" element={<Quotes />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="debtbook" element={<DebtBook />} />
        <Route path="deliveries" element={<Deliveries />} />
        <Route path="settings/company" element={<CompanyProfile />} />
        <Route path="settings/users" element={<UsersManagement />} />
        <Route path="settings/roles" element={<RolesPermissions />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
};

function App() {
  return (
    <BrowserRouter>
      {/* AuthProvider entoure désormais toute l'application */}
      <AuthProvider>
        <SettingsProvider>
          <SessionProvider>
            <InventoryProvider>
              <SalesProvider>
                <PurchaseProvider>
                  <Toaster 
                    position="top-right"
                    toastOptions={{
                      duration: 3000,
                      style: {
                        background: '#ffffff',
                        color: '#1f2937',
                        padding: '12px 16px',
                        borderRadius: '12px',
                        fontSize: '14px',
                        fontWeight: '500',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                        border: '1px solid #f3f4f6',
                      },
                      success: {
                        iconTheme: {
                          primary: '#22c55e',
                          secondary: '#fff',
                        },
                      },
                    }}
                  />
                  <AppRoutes />
                </PurchaseProvider>
              </SalesProvider>
            </InventoryProvider>
          </SessionProvider>
        </SettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

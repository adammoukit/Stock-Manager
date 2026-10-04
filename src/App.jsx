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
import Categories from './pages/inventory/Categories';
import InventoryCheck from './pages/inventory/InventoryCheck';
import { PurchaseProvider } from './context/PurchaseContext';

import DebtBook from './pages/sales/DebtBook';
import Deliveries from './pages/sales/Deliveries';
import Clients from './pages/crm/Clients';
import { ClientProvider } from './context/ClientContext';
import { DeliveryProvider } from './context/DeliveryContext';

import { SettingsProvider } from './context/SettingsContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import CompanyProfile from './pages/settings/CompanyProfile';
import UsersManagement from './pages/settings/UsersManagement';
import RolesPermissions from './pages/settings/RolesPermissions';
import Suppliers from './pages/finance/Suppliers';
import Sessions from './pages/sales/Sessions';
import SalesPerformance from './pages/sales/SalesPerformance';
import Returns from './pages/sales/Returns';
import { SessionProvider } from './context/SessionContext';
import { InvoiceProvider } from './context/InvoiceContext';
import Invoices from './pages/finance/Invoices';
import PurchaseOrders from './pages/finance/PurchaseOrders';

// Composant "Barrage" pour protéger les routes
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  
  // Affiche un écran de chargement le temps de vérifier le token
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#e8eef4]">
        <div className="flex flex-col items-center gap-5 bg-white px-10 py-8 rounded-sm shadow-2xl border border-gray-100 animate-in fade-in duration-150">
          <div className="w-14 h-14 border-4 border-[#001d35]/20 border-t-[#001d35] rounded-full animate-spin"></div>
          <div className="text-center">
            <p className="text-gray-900 font-bold text-base">
              Chargement de l'application...
            </p>
            <p className="text-gray-500 text-sm mt-1">
              Vérification de la session en cours
            </p>
          </div>
        </div>
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
        <Route path="sales/analytics" element={<SalesPerformance />} />
        <Route path="sales/returns" element={<Returns />} />
        <Route path="returns" element={<Returns />} />
        <Route path="inventory" element={<ProductList />} />
        <Route path="inventory/categories" element={<Categories />} />
        <Route path="inventory/movements" element={<Movements />} />
        <Route path="inventory/check" element={<InventoryCheck />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="replenishment" element={<Replenishment />} />
        <Route path="reports" element={<Reports />} />
        <Route path="quotes" element={<Quotes />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="debtbook" element={<DebtBook />} />
        <Route path="deliveries" element={<Deliveries />} />
        <Route path="clients" element={<Clients />} />
        <Route path="settings/company" element={<CompanyProfile />} />
        <Route path="settings/users" element={<UsersManagement />} />
        <Route path="settings/roles" element={<RolesPermissions />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="purchase-orders" element={<PurchaseOrders />} />
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
              <ClientProvider>
              <SalesProvider>
                <DeliveryProvider>
                  <PurchaseProvider>
                    <InvoiceProvider>
                    <Toaster
                      position="top-right"
                      toastOptions={{ duration: 3000 }}
                    />
                    <AppRoutes />
                    </InvoiceProvider>
                  </PurchaseProvider>
                </DeliveryProvider>
              </SalesProvider>
              </ClientProvider>
            </InventoryProvider>
          </SessionProvider>
        </SettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute, PublicRoute } from "./components/RouteGuard";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { DashboardPage } from "./pages/DashboardPage";
import { AccountsPage } from "./pages/AccountsPage";
import { TransactionsPage } from "./pages/TransactionsPage";
import { CardsPage } from "./pages/CardsPage";
import { AdminPage } from "./pages/AdminPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SettingsPage } from "./pages/SettingsPage";
import { BeneficiariesPage } from "./pages/BeneficiariesPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { LoansPage } from "./pages/LoansPage";
import { FixedDepositsPage } from "./pages/FixedDepositsPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ToastProvider } from "./context/ToastContext";

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
        <Routes>
          {/* Redirect root to dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Public routes (redirect to dashboard if logged in) */}
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

          {/* Protected routes */}
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/accounts" element={<ProtectedRoute><AccountsPage /></ProtectedRoute>} />
          <Route path="/transactions" element={<ProtectedRoute><TransactionsPage /></ProtectedRoute>} />
          <Route path="/cards" element={<ProtectedRoute><CardsPage /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/beneficiaries" element={<ProtectedRoute><BeneficiariesPage /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
          <Route path="/loans" element={<ProtectedRoute><LoansPage /></ProtectedRoute>} />
          <Route path="/fds" element={<ProtectedRoute><FixedDepositsPage /></ProtectedRoute>} />

          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;

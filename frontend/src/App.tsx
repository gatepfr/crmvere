import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Tenants from './pages/SuperAdmin/Tenants';
import Demands from './pages/Dashboard/Demands';
import DashboardHome from './pages/Dashboard/DashboardHome';
import AIConfig from './pages/Dashboard/AIConfig';
import Sidebar from './components/Sidebar';

function DashboardLayout() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 ml-64 p-10 bg-slate-50 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}

function ProtectedRoute({ children, role }: { children: React.ReactNode, role?: string }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Carregando...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (role && user.role !== role) {
    return <Navigate to="/" />;
  }

  return <>{children}</>;
}

function AppContent() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/superadmin"
          element={
            <ProtectedRoute role="super_admin">
              <Tenants />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardHome />} />
          <Route path="demands" element={<Demands />} />
          <Route path="whatsapp" element={<div>Módulo WhatsApp (Em breve)</div>} />
          <Route path="ai" element={<AIConfig />} />
          <Route path="knowledge" element={<div>Base de Dados (Em breve)</div>} />
        </Route>
        <Route path="/" element={<Navigate to="/dashboard" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

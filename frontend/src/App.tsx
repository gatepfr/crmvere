import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Tenants from './pages/SuperAdmin/Tenants';
import Demands from './pages/Dashboard/Demands';
import DashboardHome from './pages/Dashboard/DashboardHome';
import { LayoutDashboard, ClipboardList, LogOut } from 'lucide-react';

function Layout({ children }: { children: React.ReactNode }) {
  const { logout, user } = useAuth();

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col fixed h-full">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-xl font-bold tracking-tight">VereadorCRM</h2>
          <p className="text-xs text-slate-400 mt-1">Gabinete Digital</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 mt-4">
          <Link 
            to="/dashboard" 
            className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-all"
          >
            <LayoutDashboard size={20} />
            <span className="font-medium">Dashboard</span>
          </Link>
          <Link 
            to="/demands" 
            className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-all"
          >
            <ClipboardList size={20} />
            <span className="font-medium">Demandas</span>
          </Link>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="mb-4 px-3">
            <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Usuário</p>
            <p className="text-sm truncate font-medium text-slate-300">{user?.email}</p>
          </div>
          <button 
            onClick={logout}
            className="w-full flex items-center space-x-3 p-3 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all"
          >
            <LogOut size={20} />
            <span className="font-medium">Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 min-h-screen">
        {children}
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
              <Layout>
                <DashboardHome />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/demands"
          element={
            <ProtectedRoute>
              <Layout>
                <Demands />
              </Layout>
            </ProtectedRoute>
          }
        />
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

import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Tenants from './pages/SuperAdmin/Tenants';
import Demands from './pages/Dashboard/Demands';
import DashboardHome from './pages/Dashboard/DashboardHome';
import AIConfig from './pages/Dashboard/AIConfig';
import WhatsAppConfig from './pages/Dashboard/WhatsAppConfig';
import KnowledgeBase from './pages/Dashboard/KnowledgeBase';
import CabinetConfig from './pages/Dashboard/CabinetConfig';
import KanbanLeads from './pages/Dashboard/KanbanLeads';
import Team from './pages/Dashboard/Team';
import Profile from './pages/Dashboard/Profile';
import VoterMap from './pages/Dashboard/VoterMap';
import Agenda from './pages/Dashboard/Agenda';
import Municipes from './pages/Dashboard/Municipes';
import Sidebar from './components/Sidebar';

function DashboardLayout() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 lg:ml-64 p-4 lg:p-10 bg-slate-50 min-h-screen">
        <div className="mt-14 lg:mt-0">
          <Outlet />
        </div>
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
          <Route path="agenda" element={<Agenda />} />
          <Route path="municipes" element={<Municipes />} />
          <Route path="demands" element={<Demands />} />
          <Route path="map" element={<VoterMap />} />
          <Route path="cabinet" element={<CabinetConfig />} />
          <Route path="kanban" element={<KanbanLeads />} />
          <Route path="whatsapp" element={<WhatsAppConfig />} />
          <Route path="ai" element={<AIConfig />} />
          <Route path="knowledge" element={<KnowledgeBase />} />
          <Route path="team" element={<Team />} />
          <Route path="profile" element={<Profile />} />
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

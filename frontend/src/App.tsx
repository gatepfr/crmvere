import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SubscriptionProvider, SubscriptionGuard } from './components/SubscriptionGuard';
import { BillingBanner } from './components/BillingBanner';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import Tenants from './pages/SuperAdmin/Tenants';
import Demands from './pages/Dashboard/Demands';
import Legislativo from './pages/Dashboard/Legislativo';
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
import IALab from './pages/Dashboard/IALab';
import Eleicoes from './pages/Dashboard/Eleicoes';
import MyTasks from './pages/Dashboard/MyTasks';
import Broadcasts from './pages/Dashboard/Broadcasts';
import Reports from './pages/Dashboard/Reports';
import StrategicIntelligence from './pages/Intelligence/StrategicDashboard';
import Billing from './pages/Billing';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import Sidebar from './components/Sidebar';
import WhatsAppSupport from './components/WhatsAppSupport';

function DashboardLayout() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        <BillingBanner />
        <main className="flex-1 p-4 lg:p-10 bg-slate-50">
          <div className="mt-14 lg:mt-0">
            <SubscriptionGuard>
              <Outlet />
            </SubscriptionGuard>
          </div>
        </main>
      </div>
      <WhatsAppSupport />
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
      <SubscriptionProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
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
            <Route path="eleicoes" element={<Eleicoes />} />
            <Route path="strategic-intelligence" element={<StrategicIntelligence />} />
            <Route path="ai-lab" element={<IALab />} />
            <Route path="demands" element={<Demands />} />
            <Route path="legislativo" element={<Legislativo />} />
            <Route path="my-tasks" element={<MyTasks />} />
            <Route path="broadcasts" element={<Broadcasts />} />
            <Route path="reports" element={<Reports />} />
            <Route path="map" element={<VoterMap />} />
            <Route path="cabinet" element={<CabinetConfig />} />
            <Route path="kanban" element={<KanbanLeads />} />
            <Route path="whatsapp" element={<WhatsAppConfig />} />
            <Route path="ai" element={<AIConfig />} />
            <Route path="knowledge" element={<KnowledgeBase />} />
            <Route path="team" element={<Team />} />
            <Route path="profile" element={<Profile />} />
            <Route path="billing" element={<Billing />} />
          </Route>
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </SubscriptionProvider>
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

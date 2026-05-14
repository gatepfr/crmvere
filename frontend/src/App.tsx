import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { Toaster } from './components/ui/sonner';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SubscriptionProvider, SubscriptionGuard } from './components/SubscriptionGuard';
import { BillingBanner } from './components/BillingBanner';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import Tenants from './pages/SuperAdmin/Tenants';
import Demands from './pages/Dashboard/Demands';
import Legislativo from './pages/Dashboard/Legislativo';
import Documentos from './pages/Dashboard/Documentos';
import FormularioPublico from './pages/Dashboard/FormularioPublico';
import DashboardHome from './pages/Dashboard/DashboardHome';
import AIConfig from './pages/Dashboard/AIConfig';
import WhatsAppConfig from './pages/Dashboard/WhatsAppConfig';
import InstagramConfig from './pages/Dashboard/InstagramConfig';
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
import Broadcasts from './pages/Dashboard/Broadcasts';
import Reports from './pages/Dashboard/Reports';
import StrategicIntelligence from './pages/Intelligence/StrategicDashboard';
import Billing from './pages/Billing';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import PublicDemandPage from './pages/Public/PublicDemandPage';
import Sidebar from './components/Sidebar';
import WhatsAppSupport from './components/WhatsAppSupport';
import { SidebarInset, SidebarProvider, SidebarTrigger } from './components/ui/sidebar';

function DashboardLayout() {
  return (
    <SidebarProvider>
      <Sidebar />
      <SidebarInset className="bg-slate-50">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-slate-200/70 px-4 md:border-0 md:h-10 md:px-6 md:pt-2">
          <SidebarTrigger className="text-slate-500 hover:bg-slate-100 hover:text-slate-700 -ml-1" />
          <img src="/logo_site.png" alt="CRM do Verê" className="h-7 w-auto md:hidden" />
        </header>
        <BillingBanner />
        <div className="flex-1 p-4 lg:p-10">
          <SubscriptionGuard>
            <Outlet />
          </SubscriptionGuard>
        </div>
      </SidebarInset>
      <WhatsAppSupport />
    </SidebarProvider>
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
          <Route path="/p/:slug" element={<PublicDemandPage />} />
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
            <Route path="documentos" element={<Documentos />} />
            <Route path="formulario-publico" element={<FormularioPublico />} />
            <Route path="broadcasts" element={<Broadcasts />} />
            <Route path="reports" element={<Reports />} />
            <Route path="map" element={<VoterMap />} />
            <Route path="cabinet" element={<CabinetConfig />} />
            <Route path="kanban" element={<KanbanLeads />} />
            <Route path="whatsapp" element={<WhatsAppConfig />} />
            <Route path="instagram" element={<InstagramConfig />} />
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
    <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>
      <AuthProvider>
        <AppContent />
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </ThemeProvider>
  );
}

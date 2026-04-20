import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  MessageCircle,
  Bot,
  LogOut,
  Map,
  Building2,
  Users,
  User,
  Menu,
  X,
  Layout as KanbanIcon,
  Calendar,
  Sparkles,
  Zap,
  ClipboardList,
  Settings,
  Target,
  ListTodo
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar() {
  const { logout, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { name: 'Agenda', icon: Calendar, path: '/dashboard/agenda' },
    { name: 'Inteligência Eleitoral', icon: Zap, path: '/dashboard/eleicoes' },
    { name: 'Estratégia Territorial', icon: Target, path: '/dashboard/strategic-intelligence' },
    { name: 'Atendimento On Line', icon: MessageSquare, path: '/dashboard/demands' },
    { name: 'Indicações', icon: ClipboardList, path: '/dashboard/legislativo' },
    { name: 'Minhas Tarefas', icon: ListTodo, path: '/dashboard/my-tasks' },
    { name: 'Munícipes', icon: Users, path: '/dashboard/municipes' },
    { name: 'Funil de Leads', icon: KanbanIcon, path: '/dashboard/kanban' },
    { name: 'Mapa de Demandas', icon: Map, path: '/dashboard/map' },
    { name: 'Lab IA', icon: Sparkles, path: '/dashboard/ai-lab' },
    { name: 'WhatsApp', icon: MessageCircle, path: '/dashboard/whatsapp' },
    { name: 'Configuração IA', icon: Bot, path: '/dashboard/ai' },
    { name: 'Gabinete', icon: Building2, path: '/dashboard/cabinet' },
    { name: 'Configurações', icon: Settings, path: '/dashboard/profile' },
  ];

  const toggleSidebar = () => setIsOpen(!isOpen);

  return (
    <>
      {/* Hamburger Menu Mobile */}
      <div className="lg:hidden fixed top-4 left-4 z-[1001]">
        <button 
          onClick={toggleSidebar}
          className="p-2 rounded-lg bg-slate-900 text-white shadow-lg"
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Overlay Mobile */}
      {isOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-slate-900/50 z-[1000] backdrop-blur-sm"
          onClick={toggleSidebar}
        />
      )}

      <div className={`
        fixed inset-y-0 left-0 w-64 bg-slate-900 text-white flex flex-col z-[1000] transition-transform duration-300
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6">
          <img src="/logo_site.png" alt="CRM do Verê" className="h-12 w-auto object-contain" />
        </div>
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setIsOpen(false)}
              end={item.path === '/dashboard'}
              className={({ isActive }) =>
                `flex items-center px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <item.icon className="mr-3 h-5 w-5" />
              {item.name}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center mb-4 px-2">
            <div className="ml-3">
              <p className="text-xs text-slate-400 truncate w-32">{user?.email}</p>
            </div>
          </div>
          <button onClick={logout} className="flex items-center w-full px-4 py-2.5 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all duration-200">
            <LogOut className="mr-3 h-5 w-5" />
            Sair
          </button>
        </div>
      </div>
    </>
  );
}

import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  MessageCircle,
  Bot,
  LogOut,
  Map,
  Building2,
  Users,
  Layout as KanbanIcon,
  Calendar,
  Sparkles,
  Zap,
  ClipboardList,
  Settings,
  Target,
  Megaphone,
  FileText,
  File,
  Globe,
  ChevronDown,
  ChevronRight,
  Camera as Instagram,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  Sidebar as SidebarUI,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from './ui/sidebar';
import { cn } from '@/lib/utils';

interface MenuItem {
  name: string;
  icon: React.ElementType;
  path: string;
}

interface MenuGroup {
  label: string;
  collapsible: boolean;
  defaultOpen: boolean;
  items: MenuItem[];
}

const menuGroups: MenuGroup[] = [
  {
    label: 'Principal',
    collapsible: false,
    defaultOpen: true,
    items: [
      { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
      { name: 'Agenda', icon: Calendar, path: '/dashboard/agenda' },
    ],
  },
  {
    label: 'Atendimento',
    collapsible: true,
    defaultOpen: true,
    items: [
      { name: 'Atendimento On Line', icon: MessageSquare, path: '/dashboard/demands' },
      { name: 'Indicações', icon: ClipboardList, path: '/dashboard/legislativo' },
      { name: 'Documentos', icon: File, path: '/dashboard/documentos' },
      { name: 'Formulário Público', icon: Globe, path: '/dashboard/formulario-publico' },
      { name: 'Munícipes', icon: Users, path: '/dashboard/municipes' },
    ],
  },
  {
    label: 'Gabinete',
    collapsible: true,
    defaultOpen: false,
    items: [
      { name: 'Inteligência Eleitoral', icon: Zap, path: '/dashboard/eleicoes' },
      { name: 'Estratégia Territorial', icon: Target, path: '/dashboard/strategic-intelligence' },
      { name: 'Prestação de Contas', icon: FileText, path: '/dashboard/reports' },
      { name: 'Mapa de Demandas', icon: Map, path: '/dashboard/map' },
      { name: 'Funil de Leads', icon: KanbanIcon, path: '/dashboard/kanban' },
    ],
  },
  {
    label: 'Comunicação',
    collapsible: true,
    defaultOpen: false,
    items: [
      { name: 'Disparo em Massa', icon: Megaphone, path: '/dashboard/broadcasts' },
      { name: 'WhatsApp', icon: MessageCircle, path: '/dashboard/whatsapp' },
      { name: 'Instagram', icon: Instagram, path: '/dashboard/instagram' },
    ],
  },
  {
    label: 'IA & Config',
    collapsible: true,
    defaultOpen: false,
    items: [
      { name: 'Lab IA', icon: Sparkles, path: '/dashboard/ai-lab' },
      { name: 'Configuração IA', icon: Bot, path: '/dashboard/ai' },
      { name: 'Gabinete', icon: Building2, path: '/dashboard/cabinet' },
      { name: 'Configurações', icon: Settings, path: '/dashboard/profile' },
    ],
  },
];

export default function Sidebar() {
  const { logout, user } = useAuth();
  const location = useLocation();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(
    Object.fromEntries(menuGroups.map((g) => [g.label, g.defaultOpen]))
  );

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <SidebarUI collapsible="icon">
      <SidebarHeader className="p-4 pb-2">
        <img
          src="/logo_site.png"
          alt="CRM do Verê"
          className="h-10 w-auto object-contain self-start group-data-[collapsible=icon]:hidden"
        />
        <div className="hidden group-data-[collapsible=icon]:flex items-center justify-center size-8">
          <LayoutDashboard className="size-5 text-sidebar-foreground" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {menuGroups.map((group) => (
          <SidebarGroup key={group.label}>
            {group.collapsible ? (
              <SidebarGroupLabel
                className="cursor-pointer select-none hover:text-sidebar-foreground/90"
                onClick={() => toggleGroup(group.label)}
              >
                <span className="flex-1">{group.label}</span>
                {openGroups[group.label] ? (
                  <ChevronDown className="ml-auto size-3.5 shrink-0" />
                ) : (
                  <ChevronRight className="ml-auto size-3.5 shrink-0" />
                )}
              </SidebarGroupLabel>
            ) : (
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            )}

            <SidebarGroupContent
              className={cn(
                !openGroups[group.label] && 'hidden group-data-[collapsible=icon]:block'
              )}
            >
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = location.pathname === item.path;

                  return (
                    <SidebarMenuItem key={item.path}>
                      {/* @ts-ignore — NavLink renders <a>, SidebarMenuButton wraps via Slot */}
                      <SidebarMenuButton asChild isActive={isActive} tooltip={item.name}>
                        <NavLink to={item.path} end={item.path === '/dashboard'}>
                          <item.icon />
                          <span>{item.name}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="sm"
              className="opacity-60 cursor-default hover:bg-transparent hover:opacity-60 group-data-[collapsible=icon]:hidden"
            >
              <span className="text-xs truncate">{user?.email}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            {/* @ts-ignore */}
            <SidebarMenuButton tooltip="Sair" onClick={logout}>
              <LogOut />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </SidebarUI>
  );
}

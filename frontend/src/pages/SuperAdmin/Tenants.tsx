import React, { useEffect, useState, useCallback } from 'react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { 
  Users, 
  Building2, 
  MessageSquare, 
  UserCheck, 
  Trash2, 
  Power, 
  LayoutDashboard, 
  Settings,
  PlusCircle,
  LogOut,
  Clock,
  Star,
  Infinity,
  CalendarDays,
  Zap,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';

interface Stats {
  tenants: number;
  users: number;
  demandas: number;
  municipes: number;
}

export default function Tenants() {
  const [activeTab, setActiveTab] = useState<'tenants' | 'users' | 'stats'>('tenants');
  const [tenants, setTenants] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [stats, setStats] = useState<Stats>({ tenants: 0, users: 0, demandas: 0, municipes: 0 });
  const [globalConfig, setGlobalConfig] = useState<{ defaultDailyTokenLimit: number }>({ defaultDailyTokenLimit: 50000 });
  
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [email, setEmail] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { logout } = useAuth();

  // AI Hub State
  const [editingAI, setEditingAI] = useState<any>(null);
  const [aiConfig, setAIConfig] = useState({
    aiProvider: 'gemini',
    aiApiKey: '',
    aiModel: 'gemini-1.5-flash',
    aiBaseUrl: ''
  });

  const loadData = useCallback(async () => {
    try {
      const [tenantsRes, statsRes, usersRes, configRes] = await Promise.all([
        api.get('/superadmin/tenants'),
        api.get('/superadmin/stats'),
        api.get('/superadmin/users'),
        api.get('/superadmin/config')
      ]);
      setTenants(tenantsRes.data);
      setStats(statsRes.data);
      setAllUsers(usersRes.data);
      setGlobalConfig(configRes.data);
    } catch (err) {
      setError('Falha ao carregar dados do sistema.');
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveAI = async () => {
    if (!editingAI) return;
    setLoading(true);
    try {
      await api.patch(`/superadmin/tenants/${editingAI.id}`, aiConfig);
      alert('Configuração de IA atualizada!');
      setEditingAI(null);
      loadData();
    } catch (err) {
      alert('Erro ao salvar config de IA.');
    } finally {
      setLoading(false);
    }
  };

  const openAIHub = (tenant: any) => {
    setEditingAI(tenant);
    setAIConfig({
      aiProvider: tenant.aiProvider || 'gemini',
      aiApiKey: tenant.aiApiKey || '',
      aiModel: tenant.aiModel || 'gemini-1.5-flash',
      aiBaseUrl: tenant.aiBaseUrl || ''
    });
  };

  const updateGlobalTokenLimit = async () => {
    const newVal = prompt('Novo limite diário PADRÃO para novos gabinetes:', globalConfig.defaultDailyTokenLimit.toString());
    if (!newVal) return;
    try {
      await api.patch('/superadmin/config', { defaultDailyTokenLimit: parseInt(newVal) });
      loadData();
      alert('Configuração global atualizada!');
    } catch (err) {
      alert('Erro ao atualizar config global.');
    }
  };

  const adjustTokens = async (id: string, current: number) => {
    const adjustment = prompt('Ajustar tokens (Ex: 10000 para adicionar, -5000 para remover):', '10000');
    if (!adjustment) return;
    try {
      await api.patch(`/superadmin/tenants/${id}`, { tokenAdjustment: parseInt(adjustment) });
      loadData();
      alert('Quota ajustada com sucesso!');
    } catch (err) {
      alert('Falha ao ajustar tokens.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este gabinete? Todos os dados vinculados serão perdidos.')) return;
    try {
      await api.delete(`/superadmin/tenants/${id}`);
      loadData();
    } catch (err) {
      alert('Falha ao excluir gabinete.');
    }
  };

  const toggleStatus = async (tenant: any) => {
    try {
      await api.patch(`/superadmin/tenants/${tenant.id}`, { active: !tenant.active });
      loadData();
    } catch (err) {
      alert('Falha ao atualizar status.');
    }
  };

  const toggleBlockIA = async (tenant: any) => {
    try {
      await api.patch(`/superadmin/tenants/${tenant.id}`, { blocked: !tenant.blocked });
      loadData();
      alert(`IA ${!tenant.blocked ? 'Bloqueada' : 'Desbloqueada'} para este gabinete.`);
    } catch (err) {
      alert('Falha ao atualizar Kill Switch.');
    }
  };

  const updateQuota = async (id: string, limit: number) => {
    try {
      await api.patch(`/superadmin/tenants/${id}`, { dailyTokenLimit: limit });
      loadData();
      alert('Quota atualizada com sucesso!');
    } catch (err) {
      alert('Falha ao atualizar quota.');
    }
  };

  const updateSubscription = async (id: string, status: string, trialEndsAt?: string) => {
    try {
      await api.patch(`/superadmin/tenants/${id}/subscription`, { status, trialEndsAt });
      loadData();
      alert('Assinatura atualizada com sucesso!');
    } catch (err) {
      alert('Falha ao atualizar assinatura.');
    }
  };

  const handleResetDatabase = async () => {
    const confirm1 = confirm('⚠️ PERIGO: Isso vai apagar TODAS as demandas, munícipes e documentos de TODOS os gabinetes. Deseja continuar?');
    if (!confirm1) return;
    
    const confirm2 = confirm('TEM CERTEZA ABSOLUTA? Esta ação não pode ser desfeita e o sistema ficará vazio.');
    if (!confirm2) return;

    setLoading(true);
    try {
      await api.post('/superadmin/reset-database');
      alert('Banco de dados zerado com sucesso!');
      loadData();
    } catch (err) {
      alert('Falha ao zerar banco de dados.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      await api.post('/superadmin/tenants', { name, slug, email });
      setName('');
      setSlug('');
      setEmail('');
      loadData();
      alert('Gabinete criado com sucesso! Senha padrão: admin123');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Falha ao criar gabinete.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Navbar Superior */}
      <header className="bg-slate-900 text-white shadow-lg sticky top-0 z-10">
        <div className="px-6 py-4 mx-auto max-w-7xl flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg shadow-inner">
              <LayoutDashboard size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter" style={{ color: '#FACC15' }}>CENTRAL SUPER ADMIN</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Painel de Controle do Sistema</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-slate-300">Administrador Global</p>
              <div className="flex items-center gap-1 text-[10px] text-green-400">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                SISTEMA ONLINE
              </div>
            </div>
            <button 
              onClick={logout} 
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-red-600 transition-all rounded-xl text-sm font-bold shadow-sm"
            >
              <LogOut size={16} />
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="px-6 py-8 mx-auto max-w-7xl w-full flex-1 space-y-8">
        
        {/* Cards de Estatísticas */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex items-center gap-4 transition-transform hover:scale-[1.02]">
            <div className="bg-blue-50 p-4 rounded-2xl text-blue-600">
              <Building2 size={28} />
            </div>
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Gabinetes</p>
              <h4 className="text-3xl font-black text-slate-900">{stats.tenants}</h4>
            </div>
          </div>
          
          {/* Global Config Card */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex items-center gap-4 transition-transform hover:scale-[1.02]">
            <div className="bg-amber-50 p-4 rounded-2xl text-amber-600">
              <Zap size={28} />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quota Padrão IA</p>
              <h4 className="text-2xl font-black text-slate-900">{(globalConfig.defaultDailyTokenLimit / 1000).toFixed(0)}k</h4>
              <button 
                onClick={updateGlobalTokenLimit}
                className="text-[9px] font-black text-blue-600 uppercase hover:underline mt-1"
              >
                Alterar Padrão
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex items-center gap-4 transition-transform hover:scale-[1.02]">
            <div className="bg-purple-50 p-4 rounded-2xl text-purple-600">
              <Users size={28} />
            </div>
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Usuários</p>
              <h4 className="text-3xl font-black text-slate-900">{stats.users}</h4>
            </div>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex items-center gap-4 transition-transform hover:scale-[1.02]">
            <div className="bg-green-50 p-4 rounded-2xl text-green-600">
              <MessageSquare size={28} />
            </div>
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Demandas</p>
              <h4 className="text-3xl font-black text-slate-900">{stats.demandas}</h4>
            </div>
          </div>
        </section>

        {/* Abas de Navegação */}
        <nav className="flex gap-2 p-1.5 bg-slate-200 rounded-2xl w-fit">
          <button 
            onClick={() => setActiveTab('tenants')}
            className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${activeTab === 'tenants' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Gabinetes
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${activeTab === 'users' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Todos os Usuários
          </button>
        </nav>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl flex items-center gap-3 font-bold text-sm">
            <Trash2 size={18} />
            {error}
          </div>
        )}

        {/* Conteúdo: Gabinetes */}
        {activeTab === 'tenants' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Formulário Novo Gabinete */}
            <div className="lg:col-span-1 bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <PlusCircle className="text-blue-600" size={20} />
                  Novo Gabinete
                </h3>
                <p className="text-xs font-medium text-slate-500 mt-1">Configure um novo acesso para vereador.</p>
              </div>
              <form onSubmit={handleCreate} className="p-6 space-y-5">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Nome do Vereador</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-bold text-sm"
                    placeholder="Ex: Vereador João"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Slug (Identificador único)</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-bold text-sm"
                    placeholder="ex: vereador-joao"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Email Principal</label>
                  <input
                    type="email"
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-bold text-sm"
                    placeholder="admin@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? 'Processando...' : 'Criar Gabinete Agora'}
                </button>
              </form>
            </div>

            {/* Tabela de Gabinetes */}
            <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Building2 className="text-blue-600" size={20} />
                  Lista de Gabinetes
                </h3>
                <span className="text-[10px] font-black bg-slate-100 px-3 py-1 rounded-full text-slate-500">{tenants.length} TOTAL</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Gabinete</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Consumo IA</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Limite Diário</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Plano/Status</th>
                      <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tenants.map((tenant) => (
                      <tr key={tenant.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-900">{tenant.name}</p>
                          <code className="text-[10px] font-bold text-slate-400">/{tenant.slug}</code>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Zap size={14} className="text-amber-500" />
                            <span className="font-black text-slate-700">{(tenant.tokenUsageTotal / 1000).toFixed(1)}k</span>
                            <span className="text-[9px] text-slate-400 uppercase font-bold">Tokens</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <button 
                            onClick={() => adjustTokens(tenant.id, tenant.dailyTokenLimit)}
                            className="bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg font-black text-xs text-slate-600 transition-all flex items-center gap-2"
                          >
                            {(tenant.dailyTokenLimit / 1000).toFixed(0)}k
                            <PlusCircle size={12} className="text-blue-600" />
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className={`w-fit px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                              tenant.subscriptionStatus === 'lifetime' ? 'bg-amber-100 text-amber-700' :
                              tenant.subscriptionStatus === 'active' ? 'bg-green-100 text-green-700' :
                              tenant.subscriptionStatus === 'trial' ? 'bg-blue-100 text-blue-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {tenant.subscriptionStatus}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black w-fit ${tenant.active ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                              {tenant.active ? 'ACESSO ATIVO' : 'ACESSO SUSPENSO'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => openAIHub(tenant)}
                              title="Configurar Hub de IA"
                              className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl transition-all"
                            >
                              <Settings size={18} />
                            </button>
                            <button 
                              onClick={() => toggleBlockIA(tenant)}
                              title={tenant.blocked ? "Desbloquear IA" : "BLOQUEAR IA (Kill Switch)"}
                              className={`p-2 rounded-xl transition-all ${tenant.blocked ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600'}`}
                            >
                              {tenant.blocked ? <ShieldAlert size={18} /> : <ShieldCheck size={18} />}
                            </button>
                            <button 
                              onClick={() => updateSubscription(tenant.id, 'lifetime')}
                              title="Tornar Vitalício"
                              className="p-2 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-xl transition-all"
                            >
                              <Infinity size={18} />
                            </button>
                            <button 
                              onClick={() => toggleStatus(tenant)}
                              title={tenant.active ? "Desativar Gabinete" : "Ativar Gabinete"}
                              className={`p-2 rounded-xl transition-all ${tenant.active ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                            >
                              <Power size={18} />
                            </button>
                            <button 
                              onClick={() => handleDelete(tenant.id)}
                              title="Excluir Definitivamente"
                              className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-all"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Conteúdo: Usuários */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Users className="text-blue-600" size={20} />
                Gestão de Usuários do Sistema
              </h3>
              <p className="text-xs font-medium text-slate-500 mt-1">Todos os assessores e administradores cadastrados nos gabinetes.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Usuário</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Gabinete</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargo</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cadastrado em</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-900">{u.email}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-blue-600 text-sm">{u.tenantName || '---'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${u.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-400">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>

      <footer className="p-6 flex flex-col items-center gap-4">
        <button 
          onClick={handleResetDatabase}
          disabled={loading}
          className="text-[10px] font-black text-red-400 uppercase tracking-widest hover:text-red-600 transition-colors border border-red-200 px-3 py-1 rounded-lg hover:bg-red-50 disabled:opacity-50"
        >
          {loading ? 'Processando...' : 'Zerar Banco de Dados'}
        </button>
        <div className="flex flex-col items-center gap-2 opacity-50 grayscale hover:opacity-100 hover:grayscale-0 transition-all">
          <img src="/logo_site.png" alt="CRM do Verê" className="h-8 w-auto object-contain" />
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">v1.0.0 © 2026</p>
        </div>
      </footer>

      {/* AI Hub Modal */}
      {editingAI && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Zap className="text-amber-500" size={20} />
                  Hub de IA: {editingAI.name}
                </h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Configuração de Infraestrutura</p>
              </div>
              <button onClick={() => setEditingAI(null)} className="text-slate-400 hover:text-slate-600 font-black">X</button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Provedor</label>
                  <select 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-sm"
                    value={aiConfig.aiProvider}
                    onChange={e => setAIConfig({...aiConfig, aiProvider: e.target.value})}
                  >
                    <option value="gemini">Google Gemini</option>
                    <option value="openai">OpenAI (ChatGPT)</option>
                    <option value="anthropic">Anthropic (Claude)</option>
                    <option value="groq">Groq</option>
                    <option value="openrouter">OpenRouter</option>
                    <option value="custom">Custom (Ollama/API)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Modelo</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-sm"
                    placeholder="Ex: gemini-1.5-flash"
                    value={aiConfig.aiModel}
                    onChange={e => setAIConfig({...aiConfig, aiModel: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Chave de API</label>
                  <input
                    type="password"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-sm"
                    placeholder="sk-..."
                    value={aiConfig.aiApiKey}
                    onChange={e => setAIConfig({...aiConfig, aiApiKey: e.target.value})}
                  />
                </div>

                {aiConfig.aiProvider === 'custom' && (
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Base URL</label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-sm"
                      placeholder="https://..."
                      value={aiConfig.aiBaseUrl}
                      onChange={e => setAIConfig({...aiConfig, aiBaseUrl: e.target.value})}
                    />
                  </div>
                )}
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  onClick={() => setEditingAI(null)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveAI}
                  disabled={loading}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black shadow-lg shadow-blue-200 transition-all disabled:opacity-50"
                >
                  {loading ? 'Salvando...' : 'Salvar Configuração'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

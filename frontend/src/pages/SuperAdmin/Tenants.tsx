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
  PlusCircle,
  LogOut,
  Clock,
  Infinity,
  CalendarDays,
  Zap,
  ShieldAlert,
  ShieldCheck,
  Globe,
  Cpu
} from 'lucide-react';

interface Stats {
  tenants: number;
  users: number;
  demandas: number;
  municipes: number;
}

const PROVIDER_MODELS: Record<string, string[]> = {
  gemini: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  anthropic: ['claude-3-5-sonnet-20240620', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
  groq: ['llama-3.1-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
  openrouter: [
    'openai/gpt-4o', 
    'openai/gpt-4o-mini', 
    'anthropic/claude-3.5-sonnet', 
    'anthropic/claude-3-haiku',
    'google/gemini-pro-1.5',
    'google/gemini-flash-1.5',
    'meta-llama/llama-3.1-405b-instruct',
    'meta-llama/llama-3.1-70b-instruct',
    'meta-llama/llama-3.1-8b-instruct',
    'deepseek/deepseek-chat',
    'mistralai/pixtral-12b-2409',
    'qwen/qwen-2.5-72b-instruct'
  ],
};

const PROVIDER_URLS: Record<string, string> = {
  openrouter: 'https://openrouter.ai/api/v1',
  gemini: '',
  openai: '',
  anthropic: '',
  groq: ''
};

export default function Tenants() {
  const [activeTab, setActiveTab] = useState<'tenants' | 'users' | 'stats'>('tenants');
  const [tenants, setTenants] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [stats, setStats] = useState<Stats>({ tenants: 0, users: 0, demandas: 0, municipes: 0 });
  const [globalConfig, setGlobalConfig] = useState<{ defaultDailyTokenLimit: number }>({ defaultDailyTokenLimit: 50000 });
  
  // Busca e Paginacao
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [aiConfig, setAIConfig] = useState({
    aiProvider: 'gemini',
    aiApiKey: '',
    aiModel: 'gemini-1.5-flash',
    aiBaseUrl: ''
  });

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [email, setEmail] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { logout } = useAuth();

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
      
      const gConfig = configRes.data;
      setGlobalConfig(gConfig);
      setAIConfig({
        aiProvider: gConfig.aiProvider || 'gemini',
        aiApiKey: gConfig.aiApiKey || '',
        aiModel: gConfig.aiModel || 'gemini-1.5-flash',
        aiBaseUrl: gConfig.aiBaseUrl || ''
      });
    } catch (err) {
      setError('Falha ao carregar dados do sistema.');
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleProviderChange = (provider: string) => {
    const models = PROVIDER_MODELS[provider] || [];
    setAIConfig({
      ...aiConfig,
      aiProvider: provider,
      aiModel: models[0] || '',
      aiBaseUrl: PROVIDER_URLS[provider] || ''
    });
  };

  const handleSaveGlobalIA = async () => {
    setLoading(true);
    try {
      await api.patch('/superadmin/config', aiConfig);
      alert('Hub de IA Global atualizado com sucesso!');
      loadData();
    } catch (err) {
      alert('Erro ao salvar config global de IA.');
    } finally {
      setLoading(false);
    }
  };

  const updateGlobalTokenLimit = async () => {
    const newVal = prompt('Novo limite diário PADRÃO para novos gabinetes:', globalConfig.defaultDailyTokenLimit.toString());
    if (!newVal) return;
    try {
      await api.patch('/superadmin/config', { defaultDailyTokenLimit: parseInt(newVal) });
      loadData();
      alert('Limite padrão atualizado!');
    } catch (err) {
      alert('Erro ao atualizar limite padrão.');
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

  const setTrial = async (id: string) => {
    const days = prompt('Quantos dias de trial?', '7');
    if (!days) return;
    const date = new Date();
    date.setDate(date.getDate() + parseInt(days));
    updateSubscription(id, 'trial', date.toISOString());
  };

  const setLifetime = async (id: string) => {
    if (confirm('Deseja ativar acesso LIFETIME (Vitalício) para este gabinete?')) {
      updateSubscription(id, 'lifetime');
    }
  };

  const updateSubscription = async (id: string, status: string, trialEndsAt?: string) => {
    try {
      await api.patch(`/superadmin/tenants/${id}/subscription`, { status, trialEndsAt });
      loadData();
      alert('Assinatura atualizada!');
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

  const filteredTenants = tenants.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredTenants.length / itemsPerPage);
  const paginatedTenants = filteredTenants.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

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
        
        {/* Hub de IA e Estatísticas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Hub de IA Reestilizado */}
          <section className="lg:col-span-1 bg-white rounded-3xl shadow-sm border-2 border-blue-100 overflow-hidden flex flex-col h-full transition-all hover:shadow-md">
            <div className="p-5 border-b border-slate-100 bg-blue-50/50 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black text-blue-900 flex items-center gap-2 uppercase tracking-tighter">
                  <Zap className="text-amber-500" size={16} />
                  Hub de IA Centralizado
                </h3>
              </div>
              <button 
                onClick={handleSaveGlobalIA}
                disabled={loading}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black rounded-lg transition-all shadow-md shadow-blue-200 disabled:opacity-50"
              >
                {loading ? '...' : 'SALVAR'}
              </button>
            </div>
            <div className="p-5 space-y-4 flex-1">
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-1">Provedor de IA</label>
                <select 
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-xs"
                  value={aiConfig.aiProvider}
                  onChange={e => handleProviderChange(e.target.value)}
                >
                  <option value="gemini">Google Gemini</option>
                  <option value="openai">OpenAI (ChatGPT)</option>
                  <option value="anthropic">Anthropic (Claude)</option>
                  <option value="groq">Groq (Ultra Rápido)</option>
                  <option value="openrouter">OpenRouter</option>
                  <option value="custom">Outras (Personalizado)</option>
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-1 flex justify-between">
                  Modelo 
                  {aiConfig.aiProvider !== 'custom' && <span className="text-blue-500 flex items-center gap-0.5"><Cpu size={8}/> Oficial</span>}
                </label>
                {aiConfig.aiProvider === 'custom' ? (
                  <input
                    type="text"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-xs"
                    placeholder="Escreva o nome do modelo..."
                    value={aiConfig.aiModel}
                    onChange={e => setAIConfig({...aiConfig, aiModel: e.target.value})}
                  />
                ) : (
                  <select 
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-xs"
                    value={aiConfig.aiModel}
                    onChange={e => setAIConfig({...aiConfig, aiModel: e.target.value})}
                  >
                    {(PROVIDER_MODELS[aiConfig.aiProvider] || []).map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                )}
              </div>

              {(aiConfig.aiProvider === 'openrouter' || aiConfig.aiProvider === 'custom') && (
                <div className="animate-in slide-in-from-top-2 duration-200">
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-1 flex items-center gap-1">
                    <Globe size={10} /> Base URL da API
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-xs"
                    placeholder="https://api..."
                    value={aiConfig.aiBaseUrl}
                    onChange={e => setAIConfig({...aiConfig, aiBaseUrl: e.target.value})}
                  />
                </div>
              )}

              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-1">Chave de API (Geral)</label>
                <input
                  type="password"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-xs"
                  placeholder="sk-..."
                  value={aiConfig.aiApiKey}
                  onChange={e => setAIConfig({...aiConfig, aiApiKey: e.target.value})}
                />
              </div>
            </div>
          </section>

          {/* Coluna de Estatísticas */}
          <section className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6 h-fit">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex items-center gap-4 transition-all hover:border-amber-200">
              <div className="bg-amber-50 p-4 rounded-2xl text-amber-600">
                <Zap size={28} />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quota Diária Padrão</p>
                <div className="flex items-center gap-2">
                  <h4 className="text-3xl font-black text-slate-900">{(globalConfig.defaultDailyTokenLimit / 1000).toFixed(0)}k</h4>
                  <button onClick={updateGlobalTokenLimit} className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors">
                    <PlusCircle size={14} />
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex items-center gap-4">
              <div className="bg-blue-50 p-4 rounded-2xl text-blue-600">
                <Building2 size={28} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gabinetes</p>
                <h4 className="text-3xl font-black text-slate-900">{stats.tenants}</h4>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex items-center gap-4">
              <div className="bg-purple-50 p-4 rounded-2xl text-purple-600">
                <Users size={28} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Usuários</p>
                <h4 className="text-3xl font-black text-slate-900">{stats.users}</h4>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex items-center gap-4">
              <div className="bg-green-50 p-4 rounded-2xl text-green-600">
                <MessageSquare size={28} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Demandas</p>
                <h4 className="text-3xl font-black text-slate-900">{stats.demandas}</h4>
              </div>
            </div>
          </section>
        </div>

        {/* Abas */}
        <nav className="flex gap-2 p-1.5 bg-slate-200 rounded-2xl w-fit">
          <button onClick={() => setActiveTab('tenants')} className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${activeTab === 'tenants' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Gabinetes</button>
          <button onClick={() => setActiveTab('users')} className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${activeTab === 'users' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Usuários</button>
        </nav>

        {activeTab === 'tenants' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-1 bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">Novo Gabinete</h3>
              </div>
              <form onSubmit={handleCreate} className="p-6 space-y-5">
                <input type="text" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-sm" placeholder="Nome do Vereador" value={name} onChange={e => setName(e.target.value)} />
                <input type="text" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-sm" placeholder="Slug (ex: vereador-joao)" value={slug} onChange={e => setSlug(e.target.value)} />
                <input type="email" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-sm" placeholder="Email Principal" value={email} onChange={e => setEmail(e.target.value)} />
                <button type="submit" disabled={loading} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg">Criar Gabinete</button>
              </form>
            </div>

            <div className="lg:col-span-2 space-y-4">
              {/* Barra de Busca */}
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-3">
                <Users className="text-slate-400" size={20} />
                <input 
                  type="text" 
                  placeholder="Buscar gabinete por nome ou slug..." 
                  className="flex-1 outline-none font-bold text-sm text-slate-600"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>

              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Gabinete</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase text-center">Quota</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Plano</th>
                        <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedTenants.map(tenant => (
                        <tr key={tenant.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4">
                            <p className="font-bold text-slate-900">{tenant.name}</p>
                            <code className="text-[9px] text-slate-400">/{tenant.slug}</code>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button onClick={() => adjustTokens(tenant.id, tenant.dailyTokenLimit)} className="px-3 py-1 bg-slate-100 rounded-lg font-black text-[10px]" title="Ajustar limite de tokens">{(tenant.dailyTokenLimit / 1000).toFixed(0)}k</button>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                              tenant.subscriptionStatus === 'active' ? 'bg-green-100 text-green-700' : 
                              tenant.subscriptionStatus === 'lifetime' ? 'bg-purple-100 text-purple-700' :
                              tenant.subscriptionStatus === 'trial' ? 'bg-amber-100 text-amber-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {tenant.subscriptionStatus}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-1.5">
                              <button onClick={() => setTrial(tenant.id)} className="p-2 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100" title="Definir dias de Trial gratuito"><Clock size={16}/></button>
                              <button onClick={() => setLifetime(tenant.id)} className="p-2 bg-purple-50 text-purple-600 rounded-xl hover:bg-purple-100" title="Ativar acesso Vitalício (Lifetime)"><Infinity size={16}/></button>
                              <button onClick={() => toggleBlockIA(tenant)} className={`p-2 rounded-xl ${tenant.blocked ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600'}`} title={tenant.blocked ? "Desbloquear IA" : "Bloquear IA (Kill Switch)"}>{tenant.blocked ? <ShieldAlert size={16}/> : <ShieldCheck size={16}/>}</button>
                              <button onClick={() => toggleStatus(tenant)} className="p-2 bg-slate-100 rounded-xl" title={tenant.active ? "Desativar Gabinete" : "Ativar Gabinete"}><Power size={16}/></button>
                              <button onClick={() => handleDelete(tenant.id)} className="p-2 bg-red-50 text-red-600 rounded-xl" title="Excluir Gabinete Permanentemente"><Trash2 size={16}/></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {paginatedTenants.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-6 py-10 text-center text-slate-400 font-bold text-sm">
                            Nenhum gabinete encontrado.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Controles de Paginação */}
                {totalPages > 1 && (
                  <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Página {currentPage} de {totalPages}</p>
                    <div className="flex gap-2">
                      <button 
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => prev - 1)}
                        className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-black disabled:opacity-50 hover:bg-slate-50 transition-all"
                      >
                        ANTERIOR
                      </button>
                      <button 
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(prev => prev + 1)}
                        className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-black disabled:opacity-50 hover:bg-slate-50 transition-all"
                      >
                        PRÓXIMA
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Usuário</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Gabinete</th>
                    <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allUsers.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-bold text-slate-900">{u.email}</td>
                      <td className="px-6 py-4 text-blue-600 font-bold">{u.tenantName || '---'}</td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={async () => {
                            if (!confirm(`Deseja realmente resetar a senha de ${u.email} para admin123?`)) return;
                            try {
                              await api.post(`/superadmin/users/${u.id}/reset-password`);
                              alert('Senha resetada com sucesso para: admin123');
                            } catch (err) {
                              alert('Falha ao resetar senha.');
                            }
                          }}
                          className="px-3 py-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg text-[10px] font-black border border-amber-100 transition-all"
                        >
                          RESETAR SENHA
                        </button>
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
        <button onClick={handleResetDatabase} className="text-[10px] font-black text-red-400 uppercase border border-red-200 px-3 py-1 rounded-lg">Zerar Banco de Dados</button>
        <div className="flex flex-col items-center gap-2 opacity-50 grayscale">
          <img src="/logo_site.png" alt="CRM do Verê" className="h-8 w-auto object-contain" />
          <p className="text-[8px] font-black text-slate-400 uppercase">v1.0.0 © 2026</p>
        </div>
      </footer>
    </div>
  );
}

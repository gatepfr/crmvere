import React, { useEffect, useState, useCallback } from 'react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  Users,
  Building2,
  MessageSquare,
  Trash2,
  Power,
  LayoutDashboard,
  PlusCircle,
  LogOut,
  Clock,
  Infinity,
  Zap,
  ShieldAlert,
  ShieldCheck,
  Globe,
  Cpu,
  Settings,
  X,
  Tag,
  Pencil,
  Check,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Search,
  Plus
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

interface GlobalCategory { id: string; name: string; color: string; icon: string; order: number; }

export default function Tenants() {
  const [activeTab, setActiveTab] = useState<'tenants' | 'users' | 'categories'>('tenants');
  const [globalCats, setGlobalCats] = useState<GlobalCategory[]>([]);
  const [editingCat, setEditingCat] = useState<GlobalCategory | null>(null);
  const [newCat, setNewCat] = useState({ name: '', color: '#2563eb' });
  const [tenants, setTenants] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [stats, setStats] = useState<Stats>({ tenants: 0, users: 0, demandas: 0, municipes: 0 });
  const [globalConfig, setGlobalConfig] = useState<{ defaultDailyTokenLimit: number }>({ defaultDailyTokenLimit: 50000 });
  
  // Busca e Paginacao
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Ordenacao
  const [sortField, setSortField] = useState<'name' | 'dailyTokenLimit' | 'subscriptionStatus' | null>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: 'name' | 'dailyTokenLimit' | 'subscriptionStatus') => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setCurrentPage(1);
  };

  // Edit Modal State
  const [editingTenant, setEditingTenant] = useState<any>(null);
  const [editForm, setEditEditForm] = useState({
    name: '',
    slug: '',
    birthdayMessage: '',
    legislativeMessage: ''
  });

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
  const [showAIHub, setShowAIHub] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { logout } = useAuth();

  const loadData = useCallback(async () => {
    try {
      const [tenantsRes, statsRes, usersRes, configRes, catsRes] = await Promise.all([
        api.get('/superadmin/tenants'),
        api.get('/superadmin/stats'),
        api.get('/superadmin/users'),
        api.get('/superadmin/config'),
        api.get('/superadmin/categories')
      ]);
      setTenants(tenantsRes.data);
      setStats(statsRes.data);
      setAllUsers(usersRes.data);
      setGlobalCats(catsRes.data);

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

  const handleAddCat = async () => {
    if (!newCat.name.trim()) return;
    try {
      await api.post('/superadmin/categories', newCat);
      setNewCat({ name: '', color: '#2563eb' });
      loadData();
    } catch { alert('Erro ao criar categoria.'); }
  };

  const handleSaveCat = async () => {
    if (!editingCat) return;
    try {
      await api.patch(`/superadmin/categories/${editingCat.id}`, { name: editingCat.name, color: editingCat.color });
      setEditingCat(null);
      loadData();
    } catch { alert('Erro ao salvar categoria.'); }
  };

  const handleDeleteCat = async (id: string) => {
    if (!confirm('Excluir esta categoria? Demandas existentes com ela não serão afetadas.')) return;
    try {
      await api.delete(`/superadmin/categories/${id}`);
      loadData();
    } catch { alert('Erro ao excluir categoria.'); }
  };

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
      setShowCreateModal(false);
      loadData();
      alert('Gabinete criado com sucesso! Senha padrão: admin123');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Falha ao criar gabinete.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditTenant = (tenant: any) => {
    setEditingTenant(tenant);
    setEditEditForm({
      name: tenant.name,
      slug: tenant.slug,
      birthdayMessage: tenant.birthdayMessage || '',
      legislativeMessage: tenant.legislativeMessage || ''
    });
  };

  const handleSaveTenant = async () => {
    setLoading(true);
    try {
      await api.patch(`/superadmin/tenants/${editingTenant.id}`, editForm);
      alert('Configurações do gabinete atualizadas!');
      setEditingTenant(null);
      loadData();
    } catch (err) {
      alert('Falha ao atualizar gabinete.');
    } finally {
      setLoading(false);
    }
  };

  const filteredTenants = tenants.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedTenants = sortField
    ? [...filteredTenants].sort((a, b) => {
        let va = a[sortField];
        let vb = b[sortField];
        if (sortField === 'dailyTokenLimit') {
          return sortDir === 'asc' ? va - vb : vb - va;
        }
        va = (va || '').toLowerCase();
        vb = (vb || '').toLowerCase();
        if (va < vb) return sortDir === 'asc' ? -1 : 1;
        if (va > vb) return sortDir === 'asc' ? 1 : -1;
        return 0;
      })
    : filteredTenants;

  const totalPages = Math.ceil(sortedTenants.length / itemsPerPage);
  const paginatedTenants = sortedTenants.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Navbar */}
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
          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-red-600 transition-all rounded-xl text-sm font-bold shadow-sm"
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </header>

      <main className="px-6 py-6 mx-auto max-w-7xl w-full flex-1 space-y-5">

        {/* Stats em linha */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-3 hover:border-amber-200 transition-colors">
            <div className="bg-amber-50 p-3 rounded-xl text-amber-600 flex-shrink-0"><Zap size={20} /></div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Quota Padrão</p>
              <div className="flex items-center gap-1.5">
                <h4 className="text-2xl font-black text-slate-900">{(globalConfig.defaultDailyTokenLimit / 1000).toFixed(0)}k</h4>
                <button onClick={updateGlobalTokenLimit} className="p-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors">
                  <PlusCircle size={12} />
                </button>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-3">
            <div className="bg-blue-50 p-3 rounded-xl text-blue-600 flex-shrink-0"><Building2 size={20} /></div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Gabinetes</p>
              <h4 className="text-2xl font-black text-slate-900">{stats.tenants}</h4>
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-3">
            <div className="bg-purple-50 p-3 rounded-xl text-purple-600 flex-shrink-0"><Users size={20} /></div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Usuários</p>
              <h4 className="text-2xl font-black text-slate-900">{stats.users}</h4>
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-3">
            <div className="bg-green-50 p-3 rounded-xl text-green-600 flex-shrink-0"><MessageSquare size={20} /></div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Demandas</p>
              <h4 className="text-2xl font-black text-slate-900">{stats.demandas}</h4>
            </div>
          </div>
        </div>

        {/* Hub de IA colapsável */}
        <div className="bg-white rounded-2xl shadow-sm border-2 border-blue-100 overflow-hidden">
          <button
            className="w-full px-5 py-4 flex items-center justify-between hover:bg-blue-50/50 transition-colors"
            onClick={() => setShowAIHub(v => !v)}
          >
            <span className="text-sm font-black text-blue-900 flex items-center gap-2 uppercase tracking-tighter">
              <Zap className="text-amber-500" size={15} />
              Hub de IA Centralizado
            </span>
            <ChevronDown size={15} className={`text-slate-400 transition-transform duration-200 ${showAIHub ? 'rotate-180' : ''}`} />
          </button>
          {showAIHub && (
            <div className="border-t border-blue-100 p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                    {aiConfig.aiProvider !== 'custom' && <span className="text-blue-500 flex items-center gap-0.5"><Cpu size={8} /> Oficial</span>}
                  </label>
                  {aiConfig.aiProvider === 'custom' ? (
                    <input
                      type="text"
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-xs"
                      placeholder="Nome do modelo..."
                      value={aiConfig.aiModel}
                      onChange={e => setAIConfig({ ...aiConfig, aiModel: e.target.value })}
                    />
                  ) : (
                    <select
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-xs"
                      value={aiConfig.aiModel}
                      onChange={e => setAIConfig({ ...aiConfig, aiModel: e.target.value })}
                    >
                      {(PROVIDER_MODELS[aiConfig.aiProvider] || []).map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  )}
                </div>
                {(aiConfig.aiProvider === 'openrouter' || aiConfig.aiProvider === 'custom') && (
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-1 flex items-center gap-1">
                      <Globe size={10} /> Base URL da API
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-xs"
                      placeholder="https://api..."
                      value={aiConfig.aiBaseUrl}
                      onChange={e => setAIConfig({ ...aiConfig, aiBaseUrl: e.target.value })}
                    />
                  </div>
                )}
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-1">Chave de API</label>
                  <input
                    type="password"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-xs"
                    placeholder="sk-..."
                    value={aiConfig.aiApiKey}
                    onChange={e => setAIConfig({ ...aiConfig, aiApiKey: e.target.value })}
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleSaveGlobalIA}
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-blue-200 disabled:opacity-50"
                >
                  {loading ? '...' : 'SALVAR CONFIGURAÇÕES DE IA'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Abas */}
        <nav className="flex gap-2 p-1.5 bg-slate-200 rounded-2xl w-fit">
          <button onClick={() => setActiveTab('tenants')} className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${activeTab === 'tenants' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Gabinetes</button>
          <button onClick={() => setActiveTab('users')} className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${activeTab === 'users' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Usuários</button>
          <button onClick={() => setActiveTab('categories')} className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${activeTab === 'categories' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Categorias</button>
        </nav>

        {/* Aba Gabinetes */}
        {activeTab === 'tenants' && (
          <div className="space-y-4">
            <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-3">
              <Search className="text-slate-400 flex-shrink-0" size={18} />
              <input
                type="text"
                placeholder="Buscar gabinete por nome ou slug..."
                className="flex-1 outline-none font-bold text-sm text-slate-600"
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              />
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-blue-100 flex-shrink-0"
              >
                <Plus size={14} />
                Novo Gabinete
              </button>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      {([
                        { field: 'name', label: 'Gabinete', align: 'left' },
                        { field: 'dailyTokenLimit', label: 'Quota', align: 'center' },
                        { field: 'subscriptionStatus', label: 'Plano', align: 'left' },
                      ] as const).map(col => (
                        <th
                          key={col.field}
                          className={`px-6 py-4 text-[10px] font-black text-slate-400 uppercase cursor-pointer select-none hover:text-slate-600 transition-colors ${col.align === 'center' ? 'text-center' : ''}`}
                          onClick={() => handleSort(col.field)}
                        >
                          <span className={`inline-flex items-center gap-1 ${col.align === 'center' ? 'justify-center w-full' : ''}`}>
                            {col.label}
                            {sortField === col.field
                              ? sortDir === 'asc'
                                ? <ChevronUp size={12} className="text-blue-500" />
                                : <ChevronDown size={12} className="text-blue-500" />
                              : <ChevronsUpDown size={12} className="opacity-30" />
                            }
                          </span>
                        </th>
                      ))}
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
                            <button onClick={() => setTrial(tenant.id)} className="p-2 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100" title="Definir dias de Trial gratuito"><Clock size={16} /></button>
                            <button onClick={() => setLifetime(tenant.id)} className="p-2 bg-purple-50 text-purple-600 rounded-xl hover:bg-purple-100" title="Ativar acesso Vitalício (Lifetime)"><Infinity size={16} /></button>
                            <button onClick={() => handleEditTenant(tenant)} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100" title="Configurar Gabinete"><Settings size={16} /></button>
                            <button onClick={() => toggleBlockIA(tenant)} className={`p-2 rounded-xl ${tenant.blocked ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600'}`} title={tenant.blocked ? 'Desbloquear IA' : 'Bloquear IA (Kill Switch)'}>{tenant.blocked ? <ShieldAlert size={16} /> : <ShieldCheck size={16} />}</button>
                            <button onClick={() => toggleStatus(tenant)} className="p-2 bg-slate-100 rounded-xl" title={tenant.active ? 'Desativar Gabinete' : 'Ativar Gabinete'}><Power size={16} /></button>
                            <button onClick={() => handleDelete(tenant.id)} className="p-2 bg-red-50 text-red-600 rounded-xl" title="Excluir Gabinete Permanentemente"><Trash2 size={16} /></button>
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
              {totalPages > 1 && (
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <p className="text-[10px] font-black text-slate-400 uppercase">Página {currentPage} de {totalPages} — {sortedTenants.length} gabinetes</p>
                  <div className="flex gap-2">
                    <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-black disabled:opacity-50 hover:bg-slate-50 transition-all">ANTERIOR</button>
                    <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-black disabled:opacity-50 hover:bg-slate-50 transition-all">PRÓXIMA</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Aba Categorias */}
        {activeTab === 'categories' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-1 bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2"><Tag size={18} className="text-blue-600" /> Nova Categoria</h3>
              </div>
              <div className="p-6 space-y-4">
                <input
                  type="text"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-sm uppercase"
                  placeholder="Nome da categoria"
                  value={newCat.name}
                  onChange={e => setNewCat({ ...newCat, name: e.target.value })}
                />
                <div className="flex items-center gap-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase">Cor</label>
                  <input type="color" className="w-10 h-10 rounded-xl border border-slate-200 cursor-pointer" value={newCat.color} onChange={e => setNewCat({ ...newCat, color: e.target.value })} />
                  <span className="font-mono text-xs text-slate-500">{newCat.color}</span>
                </div>
                <button onClick={handleAddCat} className="w-full py-3 bg-blue-600 text-white rounded-2xl font-black text-sm shadow-lg">Adicionar Categoria</button>
              </div>
            </div>
            <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-sm font-black text-slate-700 uppercase tracking-tighter flex items-center gap-2">
                  <Tag size={16} className="text-slate-400" /> Categorias Globais ({globalCats.length})
                </h3>
              </div>
              <div className="divide-y divide-slate-100">
                {globalCats.map(cat => (
                  <div key={cat.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50">
                    <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                    {editingCat?.id === cat.id ? (
                      <div className="flex-1 flex items-center gap-3">
                        <input className="flex-1 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl font-bold text-sm uppercase outline-none focus:ring-2 focus:ring-blue-500" value={editingCat.name} onChange={e => setEditingCat({ ...editingCat, name: e.target.value })} />
                        <input type="color" className="w-8 h-8 rounded-lg border border-slate-200 cursor-pointer" value={editingCat.color} onChange={e => setEditingCat({ ...editingCat, color: e.target.value })} />
                      </div>
                    ) : (
                      <span className="flex-1 font-bold text-sm text-slate-800">{cat.name}</span>
                    )}
                    <div className="flex gap-1.5 flex-shrink-0">
                      {editingCat?.id === cat.id ? (
                        <>
                          <button onClick={handleSaveCat} className="p-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-100"><Check size={15} /></button>
                          <button onClick={() => setEditingCat(null)} className="p-2 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200"><X size={15} /></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setEditingCat(cat)} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100"><Pencil size={15} /></button>
                          <button onClick={() => handleDeleteCat(cat.id)} className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-100"><Trash2 size={15} /></button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {globalCats.length === 0 && <p className="px-6 py-10 text-center text-slate-400 font-bold text-sm">Nenhuma categoria cadastrada.</p>}
              </div>
            </div>
          </div>
        )}

        {/* Aba Usuários */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Usuário</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Gabinete</th>
                    <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase">Ações</th>
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
                            } catch { alert('Falha ao resetar senha.'); }
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

      {/* Modal Criar Gabinete */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 uppercase tracking-tighter">
                <Building2 size={20} className="text-blue-600" />
                Novo Gabinete
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {error && <p className="text-red-500 text-xs font-bold bg-red-50 px-3 py-2 rounded-xl">{error}</p>}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nome do Vereador</label>
                <input type="text" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-sm focus:ring-2 focus:ring-blue-500" placeholder="Ex: João Silva" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Slug (URL)</label>
                <input type="text" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-sm focus:ring-2 focus:ring-blue-500" placeholder="Ex: vereador-joao" value={slug} onChange={e => setSlug(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Email Principal</label>
                <input type="email" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-sm focus:ring-2 focus:ring-blue-500" placeholder="email@exemplo.com" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-100">Cancelar</button>
                <button type="submit" disabled={loading} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-700 disabled:opacity-50">{loading ? 'Criando...' : 'Criar Gabinete'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Gabinete */}
      {editingTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 uppercase tracking-tighter">
                  <Settings size={20} className="text-blue-600" />
                  Configurar Gabinete
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Ajuste de mensagens e identificação</p>
              </div>
              <button onClick={() => setEditingTenant(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nome do Vereador</label>
                  <input className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500" value={editForm.name} onChange={e => setEditEditForm({ ...editForm, name: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Slug (URL)</label>
                  <input className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500" value={editForm.slug} onChange={e => setEditEditForm({ ...editForm, slug: e.target.value })} />
                </div>
              </div>
              <div className="p-4 bg-pink-50 rounded-2xl border border-pink-100 space-y-3">
                <label className="text-[10px] font-black text-pink-600 uppercase flex items-center gap-2">🎈 Mensagem de Aniversário</label>
                <textarea className="w-full p-4 bg-white border border-pink-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-pink-500 min-h-[100px]" placeholder="Ex: Olá {nome}, parabéns pelo seu aniversário!..." value={editForm.birthdayMessage} onChange={e => setEditEditForm({ ...editForm, birthdayMessage: e.target.value })} />
                <p className="text-[9px] text-pink-400 font-bold uppercase tracking-tighter italic">* Use {'{nome}'} para inserir o nome do munícipe automaticamente.</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 space-y-3">
                <label className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-2">📋 Mensagem de Indicação (Legislativo)</label>
                <textarea className="w-full p-4 bg-white border border-blue-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]" placeholder="Ex: Olá {nome}! Sua solicitação sobre {assunto} virou a Indicação nº {numero}..." value={editForm.legislativeMessage} onChange={e => setEditEditForm({ ...editForm, legislativeMessage: e.target.value })} />
                <p className="text-[9px] text-blue-400 font-bold uppercase tracking-tighter italic">* Use {'{nome}'}, {'{assunto}'}, {'{numero}'} e {'{link}'} como variáveis.</p>
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button onClick={() => setEditingTenant(null)} className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-100">Cancelar</button>
              <button onClick={handleSaveTenant} disabled={loading} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-700 disabled:opacity-50">{loading ? 'Salvando...' : 'Salvar Configurações'}</button>
            </div>
          </div>
        </div>
      )}

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

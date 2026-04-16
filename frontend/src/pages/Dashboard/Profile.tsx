import React, { useState, useEffect } from 'react';
import { 
  User, 
  Lock, 
  Mail, 
  Shield, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Tags, 
  Plus, 
  Trash2, 
  Tag as TagIcon,
  RefreshCw,
  Users,
  UserPlus,
  Calendar,
  Settings as SettingsIcon
} from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';

interface Category { id: string; name: string; color: string; }
interface Member { id: string; email: string; role: 'super_admin' | 'admin' | 'vereador' | 'assessor'; createdAt: string; }

const PRESET_COLORS = ['#2563eb', '#db2777', '#059669', '#d97706', '#7c3aed', '#4b5563', '#dc2626', '#ea580c', '#65a30d', '#0891b2'];

export default function Profile() {
  const { user } = useAuth();
  const isAdmin = user?.role !== 'assessor';
  const [activeTab, setActiveTab] = useState<'profile' | 'categories' | 'team'>('profile');

  // Perfil / Senha
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Categorias
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCats, setLoadingCats] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#2563eb');

  // Equipe
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [newMemberEmail, setNewEmail] = useState('');
  const [addingMember, setAdding] = useState(false);

  useEffect(() => {
    if (activeTab === 'categories') loadCategories();
    if (activeTab === 'team') fetchMembers();
  }, [activeTab]);

  // CATEGORIES LOGIC
  const loadCategories = async () => {
    setLoadingCats(true);
    try {
      const res = await api.get('/demands/categories');
      setCategories(res.data);
    } catch (err) { console.error(err); } finally { setLoadingCats(false); }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName) return;
    try {
      await api.post('/demands/categories', { name: newCatName.toUpperCase(), color: newCatColor });
      setNewCatName('');
      loadCategories();
    } catch (err) { alert('Erro ao criar categoria'); }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Excluir esta categoria?')) return;
    try {
      await api.delete(`/demands/categories/${id}`);
      loadCategories();
    } catch (err) { alert('Erro ao excluir'); }
  };

  const handleRestoreDefaults = async () => {
    if (!confirm('Carregar padrões?')) return;
    try { await api.post('/demands/categories/seed'); loadCategories(); } catch (err) { alert('Erro ao restaurar'); }
  };

  // TEAM LOGIC
  const fetchMembers = async () => {
    setLoadingMembers(true);
    try {
      const response = await api.get('/team');
      setMembers(response.data);
    } catch (err) { console.error(err); } finally { setLoadingMembers(false); }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      await api.post('/team', { email: newMemberEmail });
      setNewEmail('');
      fetchMembers();
      setSuccess('Membro convidado!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) { alert(err.response?.data?.error || 'Erro ao convidar'); } finally { setAdding(false); }
  };

  const handleToggleAdmin = async (id: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'assessor' : 'admin';
    if (!confirm('Deseja alterar o cargo deste usuário?')) return;
    try {
      await api.patch(`/team/${id}/role`, { role: newRole });
      fetchMembers();
    } catch (err) { alert('Erro ao atualizar cargo'); }
  };

  const handleDeleteMember = async (id: string) => {
    if (!confirm('Remover este membro?')) return;
    try { await api.delete(`/team/${id}`); fetchMembers(); } catch (err) { alert('Erro ao remover'); }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { setError('As senhas não coincidem.'); return; }
    setLoading(true);
    try {
      await api.patch('/profile/password', { newPassword });
      setSuccess('Senha alterada!');
      setNewPassword(''); setConfirmPassword('');
    } catch (err: any) { setError('Erro ao alterar'); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <SettingsIcon className="text-blue-600" size={32} />
          Configurações
        </h1>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Gestão Central do Gabinete</p>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
        {[
          { id: 'profile', label: 'Meu Perfil', icon: User },
          ...(isAdmin ? [
            { id: 'categories', label: 'Categorias', icon: Tags },
            { id: 'team', label: 'Equipe', icon: Users }
          ] : [])
        ].map((tab: any) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
              activeTab === tab.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-[500px]">
        {/* TAB: PROFILE */}
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-in slide-in-from-left-4 duration-300">
            <div className="md:col-span-1 bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 flex flex-col items-center text-center h-fit">
              <div className="w-24 h-24 rounded-3xl bg-blue-600 flex items-center justify-center mb-4 shadow-xl shadow-blue-200">
                <User className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-xl font-black text-slate-900 truncate w-full uppercase tracking-tighter">{user?.email.split('@')[0]}</h2>
              <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-[9px] font-black uppercase mt-2">{user?.role}</span>
              <div className="w-full pt-6 mt-6 border-t border-slate-50 flex flex-col gap-4 text-left">
                <div className="flex items-center gap-3 text-slate-600">
                  <Mail className="w-5 h-5 text-slate-400" />
                  <span className="text-sm font-bold truncate">{user?.email}</span>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 bg-white rounded-[2.5rem] p-10 shadow-sm border border-slate-100">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2 mb-8">
                <Lock size={20} className="text-blue-600" />
                Segurança da Conta
              </h3>
              <form onSubmit={handleChangePassword} className="max-w-md space-y-6">
                <input type="password" placeholder="Nova Senha" className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-blue-200 font-bold text-sm transition-all" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
                <input type="password" placeholder="Confirme a Senha" className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-blue-200 font-bold text-sm transition-all" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
                {success && <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase flex items-center gap-2"><CheckCircle2 size={14}/> {success}</div>}
                <button disabled={loading} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg">
                  {loading ? 'Aguarde...' : 'ATUALIZAR SENHA'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB: CATEGORIES */}
        {activeTab === 'categories' && (
          <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-slate-100 animate-in slide-in-from-left-4 duration-300">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                  <Tags className="text-blue-600" />
                  Categorias do Gabinete
                </h2>
                <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest">Personalize o fluxo de demandas</p>
              </div>
              <button onClick={handleRestoreDefaults} className="px-5 py-2.5 bg-slate-50 text-slate-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 flex items-center gap-2 border border-slate-100"><RefreshCw size={14} /> RESTAURAR PADRÃO</button>
            </div>

            <form onSubmit={handleCreateCategory} className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100 mb-8 flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome</label>
                <input type="text" className="w-full px-5 py-3 bg-white border border-slate-200 rounded-2xl font-bold text-sm outline-none" placeholder="EX: SAÚDE" value={newCatName} onChange={e => setNewCatName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cor</label>
                <div className="flex gap-2 bg-white p-2 rounded-2xl border border-slate-200">
                  {PRESET_COLORS.slice(0, 6).map(c => (
                    <button key={c} type="button" onClick={() => setNewCatColor(c)} className={`w-6 h-6 rounded-full transition-all ${newCatColor === c ? 'ring-2 ring-blue-500 scale-110' : ''}`} style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <button type="submit" className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-200">ADICIONAR</button>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map(cat => (
                <div key={cat.id} className="p-5 bg-white border border-slate-100 rounded-3xl flex items-center justify-between group hover:border-blue-100 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md" style={{ backgroundColor: cat.color }}><TagIcon size={18} /></div>
                    <span className="font-black text-slate-800 text-sm uppercase">{cat.name}</span>
                  </div>
                  <button onClick={() => handleDeleteCategory(cat.id)} className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: TEAM */}
        {activeTab === 'team' && (
          <div className="space-y-8 animate-in slide-in-from-left-4 duration-300">
            <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-slate-100">
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2 mb-8">
                <UserPlus className="text-blue-600" />
                Convidar Membro
              </h2>
              <form onSubmit={handleAddMember} className="max-w-xl flex gap-4">
                <div className="relative flex-1">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input type="email" placeholder="E-mail do novo assessor" className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:bg-white focus:border-blue-200 transition-all" value={newMemberEmail} onChange={e => setNewEmail(e.target.value)} required />
                </div>
                <button disabled={addingMember} className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-200 flex items-center gap-2">
                  {addingMember ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  CONVIDAR
                </button>
              </form>
              <p className="text-[10px] text-slate-400 mt-3 italic font-bold uppercase tracking-widest">* A senha padrão para novos membros é 'assessor123'</p>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="px-8 py-6">Membro</th>
                    <th className="px-8 py-6">Cargo / Acesso</th>
                    <th className="px-8 py-6">Desde</th>
                    <th className="px-8 py-6 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {members.map(member => (
                    <tr key={member.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 font-black text-xs uppercase">{member.email[0]}</div>
                          <span className="font-bold text-slate-900">{member.email}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${member.role === 'admin' || member.role === 'vereador' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                          {member.role}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center text-xs font-bold text-slate-400 gap-2"><Calendar size={14}/> {new Date(member.createdAt).toLocaleDateString('pt-BR')}</div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex justify-end gap-2">
                          {member.id !== user?.id && (
                            <>
                              <button onClick={() => handleToggleAdmin(member.id, member.role)} className={`p-2 rounded-xl transition-all ${member.role === 'admin' ? 'text-amber-500 bg-amber-50' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`} title="Alterar Acesso"><Shield size={18} /></button>
                              <button onClick={() => handleDeleteMember(member.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18} /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

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
  Palette,
  Tag as TagIcon,
  RefreshCw
} from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';

interface Category {
  id: string;
  name: string;
  color: string;
}

const PRESET_COLORS = [
  '#2563eb', '#db2777', '#059669', '#d97706', '#7c3aed', 
  '#4b5563', '#dc2626', '#ea580c', '#65a30d', '#0891b2'
];

export default function Profile() {
  const { user } = useAuth();
  const isAdmin = user?.role !== 'assessor';

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

  const loadCategories = async () => {
    if (!isAdmin) return;
    setLoadingCats(true);
    try {
      const res = await api.get('/demands/categories');
      setCategories(res.data);
    } catch (err) {
      console.error('Erro ao carregar categorias');
    } finally {
      setLoadingCats(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, [isAdmin]);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName) return;
    try {
      await api.post('/demands/categories', { name: newCatName.toUpperCase(), color: newCatColor });
      setNewCatName('');
      loadCategories();
    } catch (err) {
      alert('Erro ao criar categoria');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Excluir esta categoria?')) return;
    try {
      await api.delete(`/demands/categories/${id}`);
      loadCategories();
    } catch (err) {
      alert('Erro ao excluir');
    }
  };

  const handleRestoreDefaults = async () => {
    if (!confirm('Deseja carregar as categorias padrão (Saúde, Obras, etc)?')) return;
    try {
      await api.post('/demands/categories/seed');
      loadCategories();
    } catch (err) {
      alert('Erro ao restaurar');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (newPassword !== confirmPassword) { setError('As senhas não coincidem.'); return; }
    if (newPassword.length < 6) { setError('Mínimo 6 caracteres.'); return; }

    try {
      setLoading(true);
      await api.patch('/profile/password', { newPassword });
      setSuccess('Senha alterada!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao alterar senha');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <Shield className="text-blue-600" size={32} />
          Configurações do Gabinete
        </h1>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Gerenciamento de acesso e personalização</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Lado Esquerdo: Perfil e Senha */}
        <div className="space-y-8 xl:col-span-1">
          <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-3xl bg-blue-600 flex items-center justify-center mb-4 shadow-xl shadow-blue-200">
                <User className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-xl font-black text-slate-900 truncate w-full uppercase tracking-tighter">
                {user?.email.split('@')[0]}
              </h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">{user?.role}</p>
              
              <div className="w-full pt-6 border-t border-slate-50 flex flex-col gap-4 text-left">
                <div className="flex items-center gap-3 text-slate-600">
                  <Mail className="w-5 h-5 text-slate-400" />
                  <span className="text-sm font-bold truncate">{user?.email}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 mb-6">
              <Lock size={18} className="text-blue-600" />
              Segurança
            </h3>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <input
                type="password"
                placeholder="Nova Senha"
                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-blue-200 font-bold text-sm transition-all"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Confirme a Senha"
                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-blue-200 font-bold text-sm transition-all"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
              />
              {error && <p className="text-[10px] font-black text-red-500 uppercase">{error}</p>}
              {success && <p className="text-[10px] font-black text-emerald-500 uppercase">{success}</p>}
              <button disabled={loading} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg">
                {loading ? 'Processando...' : 'Alterar Senha'}
              </button>
            </form>
          </div>
        </div>

        {/* Lado Direito: Categorias (Apenas Admin) */}
        {isAdmin && (
          <div className="xl:col-span-2 space-y-8">
            <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                    <Tags className="text-blue-600" />
                    Categorias das Demandas
                  </h2>
                  <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest">Personalize o fluxo do gabinete</p>
                </div>
                <button 
                  onClick={handleRestoreDefaults}
                  className="px-5 py-2.5 bg-slate-50 text-slate-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 flex items-center gap-2 border border-slate-100"
                >
                  <RefreshCw size={14} />
                  Padrão
                </button>
              </div>

              {/* Criar Nova */}
              <form onSubmit={handleCreateCategory} className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100 mb-8 flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome da Categoria</label>
                  <input 
                    type="text" 
                    className="w-full px-5 py-3 bg-white border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:border-blue-300"
                    placeholder="EX: ILUMINAÇÃO"
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cor</label>
                  <div className="flex gap-2 bg-white p-2 rounded-2xl border border-slate-200">
                    {PRESET_COLORS.slice(0, 5).map(c => (
                      <button key={c} type="button" onClick={() => setNewCatColor(c)} className={`w-6 h-6 rounded-full transition-all ${newCatColor === c ? 'ring-2 ring-blue-500 scale-110' : ''}`} style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
                <button type="submit" className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-200">
                  Adicionar
                </button>
              </form>

              {/* Lista */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {loadingCats ? (
                  <div className="col-span-full py-10 flex justify-center"><Loader2 className="animate-spin text-blue-600" /></div>
                ) : categories.map(cat => (
                  <div key={cat.id} className="p-5 bg-white border border-slate-100 rounded-3xl flex items-center justify-between group hover:border-blue-100 hover:bg-blue-50/10 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md" style={{ backgroundColor: cat.color }}>
                        <TagIcon size={18} />
                      </div>
                      <span className="font-black text-slate-800 text-sm uppercase">{cat.name}</span>
                    </div>
                    <button onClick={() => handleDeleteCategory(cat.id)} className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

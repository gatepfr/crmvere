import { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { 
  Users, 
  Search, 
  MapPin, 
  Phone, 
  MessageCircle, 
  MessageSquare,
  Loader2, 
  CheckSquare, 
  Square,
  Send,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileDown,
  Star,
  Edit2,
  Trash2,
  Save,
  Plus,
  Upload,
  ChevronLeft,
  ChevronRight,
  Check,
  Calendar
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Municipe {
  id: string;
  name: string;
  phone: string;
  cep?: string | null;
  bairro: string | null;
  birthDate: string | null;
  isLideranca: boolean;
  createdAt: string;
  demandCount: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function Municipes() {
  const { user } = useAuth();
  const [municipes, setMunicipes] = useState<Municipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [cabinetConfig, setCabinetConfig] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBairro, setSelectedBairro] = useState('');
  const [onlyEngaged, setOnlyEngaged] = useState(false);
  const [onlyLideranca, setOnlyLideranca] = useState(false);
  const [onlyBirthdays, setOnlyBirthdays] = useState(false);
  const [selectedMunicipes, setSelectedSelectedMunicipes] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: 'name' | 'phone' | 'bairro' | 'createdAt' | 'demandCount'; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [allBairros, setAllBairros] = useState<string[]>([]);
  
  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', phone: '', cep: '', bairro: '', birthDate: '', isLideranca: false });
  const [displayCreatePhone, setDisplayCreatePhone] = useState('');

  // Edit Modal State
  const [editingMunicipe, setEditingMunicipe] = useState<Municipe | null>(null);
  const [editForm, setEditForm] = useState({ name: '', phone: '', cep: '', bairro: '', birthDate: '', isLideranca: false });
  const [displayEditPhone, setDisplayEditPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadAllBairros = useCallback(async () => {
    try {
      const res = await api.get('/demands/municipes/list?limit=1000');
      const uniqueBairros = Array.from(new Set(res.data.data.map((m: any) => m.bairro).filter(Boolean))) as string[];
      setAllBairros(uniqueBairros);
    } catch (err) {
      console.error('Erro ao carregar bairros');
    }
  }, []);

  const loadMunicipes = useCallback(async () => {
    setLoading(true);
    try {
      if (!cabinetConfig) {
        const configRes = await api.get('/config/me');
        setCabinetConfig(configRes.data);
      }

      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        search: searchTerm,
        bairro: selectedBairro,
        engaged: onlyEngaged.toString(),
        lideranca: onlyLideranca.toString(),
        birthday: onlyBirthdays.toString(),
        sortBy: sortConfig.key,
        sortOrder: sortConfig.direction
      });
      const res = await api.get(`/demands/municipes/list?${params.toString()}`);
      setMunicipes(res.data.data || []);
      setPagination(res.data.pagination || { page: 1, limit: 25, total: 0, totalPages: 0 });
    } catch (err) {
      console.error('Erro ao carregar munícipes:', err);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, searchTerm, selectedBairro, onlyEngaged, onlyLideranca, onlyBirthdays, sortConfig, cabinetConfig]);

  useEffect(() => { loadMunicipes(); }, [loadMunicipes]);
  useEffect(() => { loadAllBairros(); }, [loadAllBairros]);
  useEffect(() => { setPagination(prev => ({ ...prev, page: 1 })); }, [searchTerm, selectedBairro, onlyEngaged, onlyLideranca, onlyBirthdays]);

  const isTodayBirthday = (dateStr: string | null) => {
    if (!dateStr) return false;
    try {
      const today = new Date();
      const brParts = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }).formatToParts(today);
      const todayDay = brParts.find(p => p.type === 'day')?.value;
      const todayMonth = brParts.find(p => p.type === 'month')?.value;
      const datePart = dateStr.split('T')[0];
      const [y, m, d] = datePart.split('-');
      return d === todayDay && m === todayMonth;
    } catch (e) { return false; }
  };

  const handleSort = (key: 'name' | 'phone' | 'bairro' | 'createdAt' | 'demandCount') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const handleCreateMunicipe = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...createForm, birthDate: parseDateToISO(createForm.birthDate) };
      await api.post('/demands/municipes', payload);
      setIsCreateModalOpen(false);
      setCreateForm({ name: '', phone: '', cep: '', bairro: '', birthDate: '', isLideranca: false });
      setDisplayCreatePhone('');
      loadMunicipes();
      alert('Munícipe cadastrado com sucesso!');
    } catch (err: any) { alert(err.response?.data?.error || 'Erro ao cadastrar munícipe.'); }
    finally { setSaving(false); }
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.length >= 12 && cleaned.startsWith('55')) cleaned = cleaned.slice(2);
    if (cleaned.length === 10) cleaned = cleaned.slice(0, 2) + '9' + cleaned.slice(2);
    if (cleaned.length === 11) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    return phone;
  };

  const formatDateDisplay = (dateStr: string | null) => {
    if (!dateStr) return '---';
    try {
      const datePart = dateStr.split('T')[0];
      const [year, month, day] = datePart.split('-');
      return `${day}/${month}/${year}`;
    } catch (e) { return '---'; }
  };

  const applyDateMask = (value: string) => {
    const raw = value.replace(/\D/g, '').slice(0, 8);
    let masked = raw;
    if (raw.length > 2) masked = `${raw.slice(0, 2)}/${raw.slice(2, 4)}`;
    if (raw.length > 4) masked = `${raw.slice(0, 2)}/${raw.slice(2, 4)}/${raw.slice(4, 8)}`;
    return masked;
  };

  const parseDateToISO = (dateStr: string) => {
    if (!dateStr || dateStr.length !== 10) return null;
    const [day, month, year] = dateStr.split('/');
    return `${year}-${month}-${day}`;
  };

  const applyPhoneMask = (value: string, type: 'create' | 'edit') => {
    const raw = value.replace(/\D/g, '').slice(0, 11);
    let masked = raw;
    if (raw.length > 2) masked = `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
    if (raw.length > 7) masked = `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7, 11)}`;
    if (type === 'create') {
      setDisplayCreatePhone(masked);
      setCreateForm(prev => ({ ...prev, phone: raw.startsWith('55') ? raw : `55${raw}` }));
    } else {
      setDisplayEditPhone(masked);
      setEditForm(prev => ({ ...prev, phone: raw.startsWith('55') ? raw : `55${raw}` }));
    }
  };

  const handleCepChange = async (value: string, type: 'create' | 'edit') => {
    const raw = value.replace(/\D/g, '').substring(0, 8);
    let masked = raw;
    if (raw.length > 5) masked = `${raw.slice(0, 5)}-${raw.slice(5)}`;
    
    if (type === 'create') {
      setCreateForm(prev => ({ ...prev, cep: masked }));
    } else {
      setEditForm(prev => ({ ...prev, cep: masked }));
    }

    if (raw.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
        const data = await response.json();
        if (!data.erro && data.bairro) {
          if (type === 'create') {
            setCreateForm(prev => ({ ...prev, bairro: data.bairro.toUpperCase() }));
          } else {
            setEditForm(prev => ({ ...prev, bairro: data.bairro.toUpperCase() }));
          }
        }
      } catch (err) {
        console.error('Erro ao buscar CEP:', err);
      }
    }
  };

  const handleEdit = (m: Municipe) => {
    setEditingMunicipe(m);
    setEditForm({ 
      name: m.name, phone: m.phone, cep: m.cep || '', bairro: m.bairro || '', 
      birthDate: m.birthDate ? formatDateDisplay(m.birthDate) : '',
      isLideranca: m.isLideranca
    });
    setDisplayEditPhone(formatPhone(m.phone));
  };

  const handleSaveEdit = async () => {
    if (!editingMunicipe) return;
    setSaving(true);
    try {
      const birthDateISO = parseDateToISO(editForm.birthDate);
      await api.patch(`/demands/municipe/${editingMunicipe.id}`, { ...editForm, birthDate: birthDateISO });
      setEditingMunicipe(null);
      alert('Dados atualizados com sucesso!');
      loadMunicipes();
    } catch (err) { alert('Falha ao atualizar dados.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Users className="text-blue-600" size={32} />
            Munícipes
          </h1>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Base de Eleitores e Lideranças</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsCreateModalOpen(true)} className="flex-1 lg:flex-none px-4 py-2.5 bg-blue-600 text-white rounded-xl font-black text-sm hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200">
            <Plus size={18} /> ADICIONAR
          </button>
        </div>
      </header>

      <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100 flex flex-col xl:flex-row items-stretch xl:items-center gap-3">
        <div className="relative flex-1 group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={16} />
          <input type="text" placeholder="Buscar por nome ou telefone..." className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-transparent rounded-xl outline-none focus:bg-white focus:border-blue-200 transition-all font-bold text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="pl-4 pr-10 py-2.5 bg-slate-50 border border-transparent rounded-xl outline-none focus:bg-white focus:border-blue-200 transition-all font-bold text-sm min-w-[160px]" value={selectedBairro} onChange={e => setSelectedBairro(e.target.value)}>
            <option value="">Todos Bairros</option>
            {allBairros.sort().map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <button onClick={() => setOnlyLideranca(!onlyLideranca)} className={`px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border ${onlyLideranca ? 'bg-blue-600 border-blue-500 text-white shadow-md' : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100'}`}>
            Lideranças
          </button>
          <button onClick={() => setOnlyBirthdays(!onlyBirthdays)} className={`px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border ${onlyBirthdays ? 'bg-pink-500 border-pink-400 text-white shadow-md' : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100'}`}>
            🎂 Hoje
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden relative">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Munícipe</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Bairro</th>
                <th className="px-4 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Nascimento</th>
                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {municipes.map(m => (
                <tr key={m.id} className="hover:bg-slate-50/50 transition-all cursor-pointer" onClick={() => handleEdit(m)}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${m.isLideranca ? 'bg-amber-100 text-amber-600 border border-amber-200' : 'bg-slate-100 text-slate-400'}`}>
                        {m.isLideranca ? <Star size={20} fill="currentColor" /> : m.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          {m.name}
                          {m.isLideranca && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[8px] font-black rounded uppercase">Liderança</span>}
                        </div>
                        <p className="text-xs font-bold text-slate-500">{formatPhone(m.phone)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 font-bold text-slate-500 text-xs uppercase">{m.bairro || '---'}</td>
                  <td className="px-4 py-4 text-center text-xs text-slate-400">{formatDateDisplay(m.birthDate)}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={(e) => { e.stopPropagation(); handleEdit(m); }} className="p-2 text-slate-400 hover:text-blue-600 rounded-lg"><Edit2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {(isCreateModalOpen || editingMunicipe) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-900">{editingMunicipe ? 'Editar' : 'Novo'} Munícipe</h3>
              <button onClick={() => { setIsCreateModalOpen(false); setEditingMunicipe(null); }} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={20} /></button>
            </div>
            
            <form onSubmit={editingMunicipe ? (e) => { e.preventDefault(); handleSaveEdit(); } : handleCreateMunicipe} className="p-8 space-y-5">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Nome Completo</label>
                <input required type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500" value={editingMunicipe ? editForm.name : createForm.name} onChange={e => editingMunicipe ? setEditForm({...editForm, name: e.target.value}) : setCreateForm({...createForm, name: e.target.value})} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">WhatsApp</label>
                  <input required type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500" value={editingMunicipe ? displayEditPhone : displayCreatePhone} onChange={e => applyPhoneMask(e.target.value, editingMunicipe ? 'edit' : 'create')} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Nascimento</label>
                  <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="DD/MM/AAAA" value={editingMunicipe ? editForm.birthDate : createForm.birthDate} onChange={e => editingMunicipe ? setEditForm({...editForm, birthDate: applyDateMask(e.target.value)}) : setCreateForm({...createForm, birthDate: applyDateMask(e.target.value)})} maxLength={10} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">CEP</label>
                  <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="00000-000" value={editingMunicipe ? editForm.cep : createForm.cep} onChange={e => handleCepChange(e.target.value, editingMunicipe ? 'edit' : 'create')} maxLength={9} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Bairro</label>
                  <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500" value={editingMunicipe ? editForm.bairro : createForm.bairro} onChange={e => editingMunicipe ? setEditForm({...editForm, bairro: e.target.value.toUpperCase()}) : setCreateForm({...createForm, bairro: e.target.value.toUpperCase()})} />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-100 rounded-2xl mt-2">
                <div className="flex items-center gap-3">
                  <Star className={`${(editingMunicipe ? editForm.isLideranca : createForm.isLideranca) ? 'text-amber-500' : 'text-slate-300'}`} size={20} fill={(editingMunicipe ? editForm.isLideranca : createForm.isLideranca) ? "currentColor" : "none"} />
                  <span className="text-xs font-black text-slate-700 uppercase tracking-tighter">Marcar como Liderança</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={editingMunicipe ? editForm.isLideranca : createForm.isLideranca}
                    onChange={e => editingMunicipe ? setEditForm({...editForm, isLideranca: e.target.checked}) : setCreateForm({...createForm, isLideranca: e.target.checked})}
                  />
                  <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              <button type="submit" disabled={saving} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg disabled:opacity-50">
                {saving ? 'Salvando...' : (editingMunicipe ? 'Salvar Alterações' : 'Cadastrar Munícipe')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

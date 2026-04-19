import { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { formatPhone } from '../../utils/formatPhone';
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
  Filter,
  Check,
  Calendar,
  ShieldCheck
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

interface CabinetConfig {
  name: string;
  municipio: string;
  uf: string;
  partido: string;
  mandato: string;
  fotoUrl: string;
  calendarUrl: string;
  birthdayMessage: string;
  birthdayAutomated: boolean;
  legislativeMessage: string;
}

export default function Municipes() {
  const { user } = useAuth();
  const [municipes, setMunicipes] = useState<Municipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [cabinetConfig, setCabinetConfig] = useState<CabinetConfig | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBairro, setSelectedBairro] = useState('');
  const [onlyLideranca, setOnlyLideranca] = useState(false);
  const [onlyBirthdays, setOnlyBirthdays] = useState(false);
  const [selectedMunicipes, setSelectedSelectedMunicipes] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: 'name' | 'phone' | 'bairro' | 'createdAt' | 'demandCount'; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [allBairros, setAllBairros] = useState<string[]>([]);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0 });

  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', phone: '', cep: '', bairro: '', birthDate: '', isLideranca: false });
  const [displayCreatePhone, setDisplayCreatePhone] = useState('');

  // Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState({ name: '', phone: '', bairro: '', birthDate: '' });

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
  }, [pagination.page, pagination.limit, searchTerm, selectedBairro, onlyLideranca, onlyBirthdays, sortConfig, cabinetConfig]);

  useEffect(() => { loadMunicipes(); }, [loadMunicipes]);
  useEffect(() => { loadAllBairros(); }, [loadAllBairros]);
  useEffect(() => { setPagination(prev => ({ ...prev, page: 1 })); }, [searchTerm, selectedBairro, onlyLideranca, onlyBirthdays]);

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

  const toggleSelect = (id: string) => {
    setSelectedSelectedMunicipes(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedMunicipes.length === municipes.length && municipes.length > 0) setSelectedSelectedMunicipes([]);
    else setSelectedSelectedMunicipes(municipes.map(m => m.id));
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

  const handleToggleLideranca = async (m: Municipe) => {
    try {
      await api.patch(`/demands/municipe/${m.id}`, { isLideranca: !m.isLideranca });
      setMunicipes(prev => prev.map(p => p.id === m.id ? { ...p, isLideranca: !p.isLideranca } : p));
    } catch (err) { alert('Erro ao atualizar status.'); }
  };

  const handleBulkLideranca = async () => {
    if (selectedMunicipes.length === 0) return;
    if (!confirm(`Tornar os ${selectedMunicipes.length} munícipes selecionados como Liderança?`)) return;
    setSaving(true);
    try {
      for (const id of selectedMunicipes) {
        await api.patch(`/demands/municipe/${id}`, { isLideranca: true });
      }
      setSelectedSelectedMunicipes([]);
      loadMunicipes();
      alert('Lideranças atualizadas com sucesso!');
    } catch (err) { alert('Erro na atualização em massa.'); }
    finally { setSaving(false); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const firstLine = text.split('\n')[0];
      const delimiter = firstLine.includes(';') ? ';' : ',';
      const headers = firstLine.split(delimiter).map(h => h.trim().replace(/"/g, ''));
      setCsvHeaders(headers);
    };
    reader.readAsText(file);
  };

  const handleImportCSV = async () => {
    if (!csvFile || !mapping.name || !mapping.phone) {
      alert('Selecione um arquivo e mapeie pelo menos Nome e Telefone.');
      return;
    }
    setSaving(true);
    const formData = new FormData();
    formData.append('file', csvFile);
    formData.append('mapping', JSON.stringify(mapping));
    try {
      await api.post('/demands/municipes/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setIsImportModalOpen(false);
      setCsvFile(null);
      setCsvHeaders([]);
      loadMunicipes();
      alert(`Importação concluída!`);
    } catch (err: any) { alert('Falha ao importar CSV: ' + (err.response?.data?.error || 'Erro desconhecido')); }
    finally { setSaving(false); }
  };

  const handleSendBirthdayMessage = async (m: Municipe) => {
    const defaultMsg = `Olá ${m.name}, parabéns pelo seu aniversário! Desejamos muita saúde, paz e realizações. Conte sempre conosco! 🎂🎈`;
    let msg = cabinetConfig?.birthdayMessage || defaultMsg;
    msg = msg.replace(/{nome}/g, m.name);
    try {
      await api.post('/whatsapp/send-direct', { phone: m.phone, message: msg });
      alert('Mensagem de aniversário enviada!');
    } catch (err: any) { alert(`Falha ao enviar: ${err.response?.data?.error || 'Verifique a conexão'}`); }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastMessage.trim()) return;
    setSending(true);
    setSendProgress({ current: 0, total: selectedMunicipes.length });
    for (let i = 0; i < selectedMunicipes.length; i++) {
      const municipe = (municipes || []).find(m => m.id === selectedMunicipes[i]);
      if (municipe) {
        try {
          const personalizedMessage = broadcastMessage.replace(/{{nome}}/g, municipe.name);
          await api.post('/whatsapp/send-direct', { phone: municipe.phone, message: personalizedMessage });
        } catch (err) { console.error(`Erro ao enviar para ${municipe.name}:`, err); }
      }
      setSendProgress(prev => ({ ...prev, current: i + 1 }));
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    setSending(false);
    setIsModalOpen(false);
    setBroadcastMessage('');
    setSelectedSelectedMunicipes([]);
    alert('Mensagens enviadas com sucesso!');
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
    if (type === 'create') setCreateForm(prev => ({ ...prev, cep: masked }));
    else setEditForm(prev => ({ ...prev, cep: masked }));
    if (raw.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
        const data = await response.json();
        if (!data.erro && data.bairro) {
          if (type === 'create') setCreateForm(prev => ({ ...prev, bairro: data.bairro.toUpperCase() }));
          else setEditForm(prev => ({ ...prev, bairro: data.bairro.toUpperCase() }));
        }
      } catch (err) { console.error('Erro ao buscar CEP:', err); }
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

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este munícipe?')) return;
    try {
      await api.delete(`/demands/municipe/${id}`);
      setMunicipes(prev => prev.filter(m => m.id !== id));
      alert('Munícipe excluído com sucesso!');
    } catch (err) { alert('Falha ao excluir munícipe.'); }
  };

  const exportToPDF = async (mode: 'page' | 'all') => {
    setExporting(true);
    try {
      let dataToExport = municipes;
      if (mode === 'all') {
        const res = await api.get(`/demands/municipes/list?limit=all&sortBy=${sortConfig.key}&sortOrder=${sortConfig.direction}`);
        dataToExport = res.data.data;
      }
      const doc = new jsPDF();
      doc.setFillColor(30, 41, 59);
      doc.rect(0, 0, 210, 40, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('RELATÓRIO DE MUNÍCIPES', 14, 20);
      doc.setFontSize(10);
      doc.text('CRM DO VERÊ - GESTÃO DE GABINETE', 14, 28);
      doc.text(`GERADO EM: ${new Date().toLocaleString('pt-BR')}`, 140, 28);
      const tableData = dataToExport.map(m => [m.name, formatPhone(m.phone), m.bairro || '---', formatDateDisplay(m.birthDate), m.demandCount.toString()]);
      autoTable(doc, {
        startY: 45, head: [['NOME COMPLETO', 'WHATSAPP', 'BAIRRO', 'NASCIMENTO', 'DEMANDAS']], body: tableData, theme: 'striped',
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 10, fontStyle: 'bold' },
        didDrawPage: (data) => { doc.setFontSize(8); doc.setTextColor(148, 163, 184); doc.text("Página " + doc.getNumberOfPages(), 14, doc.internal.pageSize.height - 10); }
      });
      doc.save(`municipes-${mode}-${new Date().getTime()}.pdf`);
      setIsExportModalOpen(false);
    } catch (err) { alert('Erro ao exportar PDF'); }
    finally { setExporting(false); }
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
          {(user?.role === 'admin' || user?.role === 'vereador') && (
            <button onClick={() => setIsImportModalOpen(true)} className="flex-1 lg:flex-none px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-black text-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2 shadow-sm">
              <Upload size={18} /> IMPORTAR
            </button>
          )}
          <button onClick={() => setIsExportModalOpen(true)} className="p-2.5 bg-white border border-slate-200 text-slate-400 rounded-xl hover:text-blue-600 hover:bg-blue-50 transition-all shadow-sm" title="Exportar PDF"><FileDown size={20} /></button>
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
          <button onClick={() => setOnlyLideranca(!onlyLideranca)} className={`px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border ${onlyLideranca ? 'bg-amber-500 border-amber-400 text-white shadow-md' : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100'}`}>Lideranças</button>
          <button onClick={() => setOnlyBirthdays(!onlyBirthdays)} className={`px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border ${onlyBirthdays ? 'bg-pink-500 border-pink-400 text-white shadow-md' : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100'}`}>🎂 Hoje</button>
          
          <select className="px-3 py-2.5 bg-slate-50 border border-transparent text-slate-600 rounded-xl outline-none font-bold text-xs" value={pagination.limit === 10000 ? 'all' : pagination.limit} onChange={e => setPagination(prev => ({ ...prev, limit: e.target.value === 'all' ? 10000 : parseInt(e.target.value), page: 1 }))}>
            <option value="25">25 / pág</option>
            <option value="50">50 / pág</option>
            <option value="100">100 / pág</option>
            <option value="all">Ver Todos</option>
          </select>
        </div>
      </div>

      {selectedMunicipes.length > 0 && (
        <div className="bg-blue-600 text-white p-4 rounded-2xl flex items-center justify-between shadow-xl animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg"><Check size={20} strokeWidth={3} /></div>
            <div><p className="font-black text-sm uppercase tracking-tighter">{selectedMunicipes.length} Selecionados</p></div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setSelectedSelectedMunicipes([])} className="px-4 py-2 text-xs font-bold hover:bg-white/10 rounded-lg">Desmarcar</button>
            <button onClick={handleBulkLideranca} className="bg-amber-500 text-white px-5 py-2 rounded-xl font-black text-xs hover:bg-amber-600 flex items-center gap-2 shadow-sm"><Star size={16} fill="currentColor" /> TORNAR LIDERANÇA</button>
            <button onClick={() => setIsModalOpen(true)} className="bg-white text-blue-600 px-5 py-2 rounded-xl font-black text-xs hover:bg-blue-50 flex items-center gap-2 shadow-sm"><MessageSquare size={16} /> ENVIAR WHATSAPP</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden relative min-h-[300px]">
        {loading && <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={32} /></div>}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="pl-6 py-4 w-12 text-center">
                   <div onClick={(e) => { e.stopPropagation(); toggleSelectAll(); }} className={`mx-auto w-5 h-5 rounded-md border-2 flex items-center justify-center cursor-pointer transition-all ${selectedMunicipes.length === municipes.length && municipes.length > 0 ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300'}`}>{selectedMunicipes.length === municipes.length && municipes.length > 0 && <Check size={12} strokeWidth={4} />}</div>
                </th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer group" onClick={() => handleSort('name')}>
                  <div className="flex items-center gap-1 group-hover:text-blue-600 transition-colors">Munícipe {sortConfig.key === 'name' ? (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-100" />}</div>
                </th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer group" onClick={() => handleSort('bairro')}>
                  <div className="flex items-center gap-1 group-hover:text-blue-600 transition-colors">Bairro {sortConfig.key === 'bairro' ? (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-100" />}</div>
                </th>
                <th className="px-4 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Nascimento</th>
                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {municipes.map(m => (
                <tr key={m.id} className={`group hover:bg-slate-50/50 transition-all cursor-pointer ${selectedMunicipes.includes(m.id) ? 'bg-blue-50/40' : ''}`} onClick={() => handleEdit(m)}>
                  <td className="pl-6 py-4" onClick={(e) => e.stopPropagation()}>
                    <div onClick={() => toggleSelect(m.id)} className={`mx-auto w-5 h-5 rounded-md border-2 flex items-center justify-center cursor-pointer transition-all ${selectedMunicipes.includes(m.id) ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 group-hover:border-slate-300'}`}>{selectedMunicipes.includes(m.id) && <Check size={12} strokeWidth={4} />}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div 
                        onClick={(e) => { e.stopPropagation(); handleToggleLideranca(m); }}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg transition-all cursor-pointer hover:scale-110 active:scale-95 ${m.isLideranca ? 'bg-amber-100 text-amber-600 border border-amber-200 shadow-sm' : 'bg-slate-100 text-slate-400 hover:bg-amber-50 hover:text-amber-400'}`}
                      >
                        {m.isLideranca ? <Star size={20} fill="currentColor" /> : m.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-2">{m.name} {m.isLideranca && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[8px] font-black rounded uppercase">Liderança</span>}</div>
                        <p className="text-xs font-bold text-slate-500">{formatPhone(m.phone)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 font-bold text-slate-500 text-xs uppercase text-center">{m.bairro || '---'}</td>
                  <td className="px-4 py-4 text-center text-xs text-slate-400">{formatDateDisplay(m.birthDate)}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      {isTodayBirthday(m.birthDate) && <button onClick={() => handleSendBirthdayMessage(m)} className="w-8 h-8 flex items-center justify-center bg-pink-50 hover:bg-pink-100 rounded-lg text-lg animate-pulse" title="Parabéns">🎈</button>}
                      <button onClick={() => handleEdit(m)} className="p-2 text-slate-400 hover:text-blue-600 rounded-lg"><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(m.id)} className="p-2 text-slate-400 hover:text-red-600 rounded-lg"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{pagination.total} MUNÍCIPES • PÁGINA {pagination.page} DE {pagination.totalPages}</p>
          <div className="flex gap-1">
            <button disabled={pagination.page === 1} onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))} className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 disabled:opacity-30 hover:bg-slate-50 shadow-sm"><ChevronLeft size={16} /></button>
            <button disabled={pagination.page === pagination.totalPages} onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))} className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 disabled:opacity-30 hover:bg-slate-50 shadow-sm"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>

      {/* Broadcast Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-900">Disparo em Massa</h3>
              <button onClick={() => !sending && setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={20} /></button>
            </div>
            <div className="p-8 space-y-6">
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100"><p className="text-sm text-blue-800">Enviando para <strong>{selectedMunicipes.length}</strong> contatos selecionados.</p></div>
              <textarea className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none" rows={5} placeholder="Olá {{nome}}! ..." value={broadcastMessage} onChange={e => setBroadcastMessage(e.target.value)} disabled={sending} />
              {sending && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-widest"><span>Enviando...</span><span>{sendProgress.current} / {sendProgress.total}</span></div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${(sendProgress.current / sendProgress.total) * 100}%` }}></div></div>
                </div>
              )}
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} disabled={sending} className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-200 rounded-xl">Cancelar</button>
              <button onClick={handleSendBroadcast} disabled={sending || !broadcastMessage.trim()} className="bg-blue-600 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-blue-700 shadow-lg flex items-center gap-2">{sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />} {sending ? 'Processando...' : 'Iniciar Disparo'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center"><h3 className="text-lg font-bold text-slate-900">Exportar PDF</h3><button onClick={() => setIsExportModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full"><X size={18} /></button></div>
            <div className="p-6 space-y-3">
              <button onClick={() => exportToPDF('page')} disabled={exporting} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-left hover:border-blue-500 hover:bg-blue-50 transition-all group">
                <div className="flex items-center gap-3"><div className="bg-white p-2 rounded-xl text-slate-400 group-hover:text-blue-600 shadow-sm"><FileDown size={20} /></div><div><p className="font-bold text-slate-900">Página Atual</p><p className="text-xs text-slate-500">Exportar {municipes.length} registros visíveis</p></div></div>
              </button>
              <button onClick={() => exportToPDF('all')} disabled={exporting} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-left hover:border-blue-500 hover:bg-blue-50 transition-all group">
                <div className="flex items-center gap-3"><div className="bg-white p-2 rounded-xl text-slate-400 group-hover:text-blue-600 shadow-sm"><Users size={20} /></div><div><p className="font-bold text-slate-900">Banco Completo</p><p className="text-xs text-slate-500">Exportar todos os {pagination.total} registros</p></div></div>
              </button>
            </div>
          </div>
        </div>
      )}

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
                  <input type="checkbox" className="sr-only peer" checked={editingMunicipe ? editForm.isLideranca : createForm.isLideranca} onChange={e => editingMunicipe ? setEditForm({...editForm, isLideranca: e.target.checked}) : setCreateForm({...createForm, isLideranca: e.target.checked})} />
                  <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>
              <button type="submit" disabled={saving} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg disabled:opacity-50">{saving ? 'Salvando...' : (editingMunicipe ? 'Salvar Alterações' : 'Cadastrar Munícipe')}</button>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-900">Importar Munícipes (CSV)</h3>
              <button onClick={() => !saving && setIsImportModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={20} /></button>
            </div>
            <div className="p-8 space-y-6">
              <div className="p-5 bg-blue-50 rounded-2xl border border-blue-100 flex flex-col items-center justify-center border-dashed border-2 cursor-pointer hover:bg-blue-100 transition-all relative">
                <input type="file" accept=".csv" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                <Upload className="text-blue-600 mb-2" size={32} />
                <p className="text-sm font-bold text-blue-900">{csvFile ? csvFile.name : 'Clique para selecionar arquivo CSV'}</p>
                <p className="text-[10px] text-blue-500 uppercase mt-1">Semicólon (;) ou vírgula (,) aceitos</p>
              </div>

              {csvHeaders.length > 0 && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Coluna do Nome</label>
                    <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" value={mapping.name} onChange={e => setMapping({...mapping, name: e.target.value})}>
                      <option value="">Selecione...</option>
                      {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Coluna do WhatsApp</label>
                    <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" value={mapping.phone} onChange={e => setMapping({...mapping, phone: e.target.value})}>
                      <option value="">Selecione...</option>
                      {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Coluna do Bairro</label>
                    <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" value={mapping.bairro} onChange={e => setMapping({...mapping, bairro: e.target.value})}>
                      <option value="">Não importar</option>
                      {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Coluna Nascimento</label>
                    <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" value={mapping.birthDate} onChange={e => setMapping({...mapping, birthDate: e.target.value})}>
                      <option value="">Não importar</option>
                      {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setIsImportModalOpen(false)} disabled={saving} className="px-6 py-2.5 text-slate-600 font-bold">Cancelar</button>
              <button onClick={handleImportCSV} disabled={saving || !csvFile || !mapping.name || !mapping.phone} className="bg-blue-600 text-white px-8 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg hover:bg-blue-700 transition-all">
                {saving ? 'Importando...' : 'Iniciar Importação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

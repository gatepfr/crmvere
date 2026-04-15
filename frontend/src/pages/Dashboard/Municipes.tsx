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
  CheckCircle2,
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
  MoreVertical,
  Filter,
  Check
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Municipe {
  id: string;
  name: string;
  phone: string;
  bairro: string | null;
  birthDate: string | null;
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
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBairro, setSelectedBairro] = useState('');
  const [onlyEngaged, setOnlyEngaged] = useState(false);
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
  const [createForm, setCreateForm] = useState({ name: '', phone: '', bairro: '', birthDate: '' });
  const [displayCreatePhone, setDisplayCreatePhone] = useState('');

  // Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState({ name: '', phone: '', bairro: '', birthDate: '' });

  // Edit Modal State
  const [editingMunicipe, setEditingMunicipe] = useState<Municipe | null>(null);
  const [editForm, setEditForm] = useState({ name: '', phone: '', bairro: '', birthDate: '' });
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
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        search: searchTerm,
        bairro: selectedBairro,
        engaged: onlyEngaged.toString(),
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
  }, [pagination.page, pagination.limit, searchTerm, selectedBairro, onlyEngaged, onlyBirthdays, sortConfig]);

  useEffect(() => {
    loadMunicipes();
  }, [loadMunicipes]);

  useEffect(() => {
    loadAllBairros();
  }, [loadAllBairros]);

  // Reset to page 1 when any filter changes
  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [searchTerm, selectedBairro, onlyEngaged, onlyBirthdays]);

  const isTodayBirthday = (dateStr: string | null) => {
    if (!dateStr) return false;
    const birthDate = new Date(dateStr);
    const today = new Date();
    
    // Check if day and month match in Brazil time
    const brDate = new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      timeZone: 'America/Sao_Paulo'
    }).format(today);
    
    const [todayDay, todayMonth] = brDate.split('/');
    
    // We use UTC methods for the birthDate because it's stored as a pure date (T12:00:00Z)
    const birthDay = birthDate.getUTCDate().toString().padStart(2, '0');
    const birthMonth = (birthDate.getUTCMonth() + 1).toString().padStart(2, '0');

    return birthDay === todayDay && birthMonth === todayMonth;
  };

  const handleSort = (key: 'name' | 'phone' | 'bairro' | 'createdAt' | 'demandCount') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const toggleSelect = (id: string) => {
    setSelectedSelectedMunicipes(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedMunicipes.length === municipes.length) {
      setSelectedSelectedMunicipes([]);
    } else {
      setSelectedSelectedMunicipes(municipes.map(m => m.id));
    }
  };

  const handleCreateMunicipe = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/demands/municipes', createForm);
      setIsCreateModalOpen(false);
      setCreateForm({ name: '', phone: '', bairro: '', birthDate: '' });
      setDisplayCreatePhone('');
      loadMunicipes();
      alert('Munícipe cadastrado com sucesso!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao cadastrar munícipe.');
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const firstLine = text.split(/\r?\n/)[0];
        
        // Detect delimiter: comma or semicolon
        const commaCount = (firstLine.match(/,/g) || []).length;
        const semicolonCount = (firstLine.match(/;/g) || []).length;
        const delimiter = semicolonCount > commaCount ? ';' : ',';
        
        const headers = firstLine.split(delimiter).map(h => h.trim().replace(/"/g, ''));
        setCsvHeaders(headers);
      };
      reader.readAsText(file);
    }
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
      const res = await api.post('/demands/municipes/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setIsImportModalOpen(false);
      setCsvFile(null);
      setCsvHeaders([]);
      loadMunicipes();
      alert(`Importação concluída! ${res.data.imported} contatos processados.`);
    } catch (err: any) {
      alert('Falha ao importar CSV: ' + (err.response?.data?.error || 'Erro desconhecido'));
    } finally {
      setSaving(false);
    }
  };

  const handleSendBirthdayMessage = async (m: Municipe) => {
    const msg = `Olá ${m.name}, parabéns pelo seu aniversário! Desejamos muita saúde, paz e realizações. Conte sempre conosco! 🎂🎈`;
    try {
      await api.post('/whatsapp/send-direct', {
        phone: m.phone,
        message: msg
      });
      alert('Mensagem de aniversário enviada!');
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Verifique a conexão com o WhatsApp';
      alert(`Falha ao enviar mensagem: ${errorMsg}`);
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastMessage.trim()) return;
    setSending(true);
    setSendProgress({ current: 0, total: selectedMunicipes.length });

    for (let i = 0; i < selectedMunicipes.length; i++) {
      const municipeId = selectedMunicipes[i];
      const municipe = (municipes || []).find(m => m.id === municipeId);
      
      if (municipe) {
        try {
          const personalizedMessage = broadcastMessage.replace(/{{nome}}/g, municipe.name);
          await api.post('/whatsapp/send-direct', {
            phone: municipe.phone,
            message: personalizedMessage
          });
        } catch (err) {
          console.error(`Erro ao enviar para ${municipe.name}:`, err);
        }
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

  const formatPhone = (phone: string) => {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.length >= 12 && cleaned.startsWith('55')) cleaned = cleaned.slice(2);
    if (cleaned.length === 10) cleaned = cleaned.slice(0, 2) + '9' + cleaned.slice(2);
    if (cleaned.length === 11) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    return phone;
  };

  const applyPhoneMask = (value: string, type: 'create' | 'edit') => {
    const raw = value.replace(/\D/g, '');
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

  const handleEdit = (m: Municipe) => {
    setEditingMunicipe(m);
    setEditForm({ 
      name: m.name, 
      phone: m.phone, 
      bairro: m.bairro || '', 
      birthDate: m.birthDate ? m.birthDate.split('T')[0] : '' 
    });
    setDisplayEditPhone(formatPhone(m.phone));
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este munícipe? Esta ação não pode ser desfeita.')) return;
    try {
      await api.delete(`/demands/municipe/${id}`);
      setMunicipes(prev => prev.filter(m => m.id !== id));
      alert('Munícipe excluído com sucesso!');
    } catch (err) {
      alert('Falha ao excluir munícipe.');
    }
  };

  const handleSaveEdit = async () => {
    if (!editingMunicipe) return;
    setSaving(true);
    try {
      await api.patch(`/demands/municipe/${editingMunicipe.id}`, editForm);
      loadMunicipes();
      setEditingMunicipe(null);
      alert('Dados atualizados com sucesso!');
    } catch (err) {
      alert('Falha ao atualizar dados.');
    } finally {
      setSaving(false);
    }
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
      doc.setFont('helvetica', 'normal');
      doc.text('CRM DO VERÊ - GESTÃO DE GABINETE', 14, 28);
      
      doc.text(`GERADO EM: ${new Date().toLocaleString('pt-BR')}`, 140, 28);

      const tableData = dataToExport.map(m => [
        m.name,
        formatPhone(m.phone),
        m.bairro || '---',
        m.birthDate ? new Date(m.birthDate).toLocaleDateString('pt-BR') : '---',
        m.demandCount.toString()
      ]);

      autoTable(doc, {
        startY: 45,
        head: [['NOME COMPLETO', 'WHATSAPP', 'BAIRRO', 'NASCIMENTO', 'DEMANDAS']],
        body: tableData,
        theme: 'striped',
        headStyles: { 
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontSize: 10,
          fontStyle: 'bold',
          halign: 'left'
        },
        bodyStyles: {
          fontSize: 9,
          textColor: [51, 65, 85]
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        margin: { top: 45 },
        didDrawPage: (data) => {
          const str = "Página " + doc.getNumberOfPages();
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(str, 14, doc.internal.pageSize.height - 10);
          doc.text("CRM do Verê - Sistema de Gestão", 160, doc.internal.pageSize.height - 10);
        }
      });

      doc.save(`municipes-${mode}-${new Date().getTime()}.pdf`);
      setIsExportModalOpen(false);
    } catch (err) {
      alert('Erro ao exportar PDF');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Users className="text-blue-600" size={32} />
            Munícipes
          </h1>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Gerencie sua base de eleitores e apoiadores</p>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="flex-1 lg:flex-none px-4 py-2.5 bg-blue-600 text-white rounded-xl font-black text-sm hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
          >
            <Plus size={18} />
            ADICIONAR
          </button>

          {(user?.role === 'admin' || user?.role === 'vereador') && (
            <button 
              onClick={() => setIsImportModalOpen(true)}
              className="flex-1 lg:flex-none px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-black text-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <Upload size={18} />
              IMPORTAR
            </button>
          )}

          <button 
            onClick={() => setIsExportModalOpen(true)}
            className="p-2.5 bg-white border border-slate-200 text-slate-400 rounded-xl hover:text-blue-600 hover:bg-blue-50 transition-all shadow-sm"
            title="Exportar PDF"
          >
            <FileDown size={20} />
          </button>
        </div>
      </header>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100 flex flex-col xl:flex-row items-stretch xl:items-center gap-3">
        <div className="relative flex-1 group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={16} />
          <input 
            type="text"
            placeholder="Buscar por nome ou telefone..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-transparent rounded-xl outline-none focus:bg-white focus:border-blue-200 transition-all font-bold text-sm"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <select 
              className="pl-4 pr-10 py-2.5 bg-slate-50 border border-transparent rounded-xl outline-none focus:bg-white focus:border-blue-200 transition-all font-bold text-sm appearance-none min-w-[160px]"
              value={selectedBairro}
              onChange={e => setSelectedBairro(e.target.value)}
            >
              <option value="">Todos Bairros</option>
              {allBairros.sort().map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
          </div>

          <button 
            onClick={() => setOnlyEngaged(!onlyEngaged)}
            className={`px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border ${
              onlyEngaged ? 'bg-amber-500 border-amber-400 text-white shadow-md' : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100'
            }`}
          >
            Engajados
          </button>

          <button 
            onClick={() => setOnlyBirthdays(!onlyBirthdays)}
            className={`px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border ${
              onlyBirthdays ? 'bg-pink-500 border-pink-400 text-white shadow-md' : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100'
            }`}
          >
            🎂 Hoje
          </button>

          <div className="h-8 w-[1px] bg-slate-100 mx-1 hidden xl:block"></div>

          <select
            className="px-3 py-2.5 bg-slate-50 border border-transparent text-slate-600 rounded-xl outline-none font-bold text-xs"
            value={pagination.limit}
            onChange={e => setPagination(prev => ({ ...prev, limit: e.target.value === 'all' ? 10000 : parseInt(e.target.value), page: 1 }))}
          >
            <option value="25">25 / pág</option>
            <option value="50">50 / pág</option>
            <option value="100">100 / pág</option>
            <option value="all">Ver Todos</option>
          </select>
        </div>
      </div>

      {/* Broadcast Bar */}
      {selectedMunicipes.length > 0 && (
        <div className="bg-blue-600 text-white p-4 rounded-2xl flex items-center justify-between shadow-xl shadow-blue-500/20 animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <Check size={20} strokeWidth={3} />
            </div>
            <div>
              <p className="font-black text-sm uppercase tracking-tighter">{selectedMunicipes.length} Selecionados</p>
              <p className="text-xs text-blue-100 font-medium">Ações em massa disponíveis</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setSelectedSelectedMunicipes([])} className="px-4 py-2 text-xs font-bold hover:bg-white/10 rounded-lg transition-all">Desmarcar</button>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-white text-blue-600 px-5 py-2 rounded-xl font-black text-xs hover:bg-blue-50 transition-all flex items-center gap-2 shadow-sm"
            >
              <MessageSquare size={16} />
              ENVIAR WHATSAPP
            </button>
          </div>
        </div>
      )}

      {/* Table / Cards Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden relative min-h-[200px]">
        {loading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center">
            <Loader2 className="animate-spin text-blue-600" size={32} />
          </div>
        )}
        {/* Mobile View */}
        <div className="lg:hidden divide-y divide-slate-50">
          {municipes.map(m => (
            <div 
              key={m.id} 
              className={`p-4 transition-all ${selectedMunicipes.includes(m.id) ? 'bg-blue-50/50' : ''}`}
              onClick={() => toggleSelect(m.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                    selectedMunicipes.includes(m.id) ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200'
                  }`}>
                    {selectedMunicipes.includes(m.id) && <Check size={12} strokeWidth={4} />}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                      {m.name}
                      {m.demandCount > 0 && <span className="text-xs font-black text-blue-600">({m.demandCount})</span>}
                      {isTodayBirthday(m.birthDate) && <span>🎂</span>}
                    </h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{formatPhone(m.phone)}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  {isTodayBirthday(m.birthDate) && (
                    <button onClick={(e) => { e.stopPropagation(); handleSendBirthdayMessage(m); }} className="p-2 text-pink-600 bg-pink-50 rounded-lg" title="Mandar Parabéns"><MessageSquare size={14} /></button>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); handleEdit(m); }} className="p-2 text-slate-400 hover:text-blue-600 transition-colors"><Edit2 size={16} /></button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(m.id); }} className="p-2 text-slate-400 hover:text-red-600 transition-colors"><Trash2 size={16} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop View */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="pl-6 py-4 w-12">
                  <div 
                    onClick={toggleSelectAll}
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center cursor-pointer transition-all ${
                      selectedMunicipes.length === municipes.length && municipes.length > 0
                        ? 'bg-blue-600 border-blue-600 text-white' 
                        : 'bg-white border-slate-300'
                    }`}
                  >
                    {selectedMunicipes.length === municipes.length && municipes.length > 0 && <Check size={12} strokeWidth={4} />}
                  </div>
                </th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer group" onClick={() => handleSort('name')}>
                  <div className="flex items-center gap-1 group-hover:text-blue-600 transition-colors">
                    Munícipe
                    {sortConfig.key === 'name' ? (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-100" />}
                  </div>
                </th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer group" onClick={() => handleSort('phone')}>
                  <div className="flex items-center gap-1 group-hover:text-blue-600 transition-colors">
                    Contato
                    {sortConfig.key === 'phone' ? (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-100" />}
                  </div>
                </th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer group" onClick={() => handleSort('bairro')}>
                  <div className="flex items-center gap-1 group-hover:text-blue-600 transition-colors">
                    Bairro
                    {sortConfig.key === 'bairro' ? (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-100" />}
                  </div>
                </th>
                <th className="px-4 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Nascimento</th>
                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {municipes.map(m => (
                <tr 
                  key={m.id} 
                  className={`group transition-all cursor-pointer ${selectedMunicipes.includes(m.id) ? 'bg-blue-50/40' : 'hover:bg-slate-50/50'}`}
                  onClick={() => toggleSelect(m.id)}
                >
                  <td className="pl-6 py-4">
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                      selectedMunicipes.includes(m.id) ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 group-hover:border-slate-300'
                    }`}>
                      {selectedMunicipes.includes(m.id) && <Check size={12} strokeWidth={4} />}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900 flex items-center gap-2">
                        {m.name}
                        {m.demandCount > 0 && (
                          <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-black rounded-md">
                            {m.demandCount}
                          </span>
                        )}
                        {isTodayBirthday(m.birthDate) && <span className="animate-bounce">🎂</span>}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Desde {new Date(m.createdAt).toLocaleDateString()}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600">
                      <Phone size={12} className="text-slate-300" />
                      {formatPhone(m.phone)}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{m.bairro || '---'}</span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="text-xs font-bold text-slate-400">
                      {m.birthDate ? new Date(m.birthDate).toLocaleDateString('pt-BR') : '---'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end items-center gap-1">
                      {isTodayBirthday(m.birthDate) && (
                        <button onClick={(e) => { e.stopPropagation(); handleSendBirthdayMessage(m); }} className="p-2 text-pink-500 hover:bg-pink-50 rounded-lg transition-all" title="Mandar Parabéns"><MessageSquare size={16} /></button>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); handleEdit(m); }} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"><Edit2 size={16} /></button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(m.id); }} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {pagination.total} MUNÍCIPES • PÁGINA {pagination.page} DE {pagination.totalPages}
          </p>
          <div className="flex items-center gap-1">
            <button 
              disabled={pagination.page === 1 || loading}
              onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
              className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 disabled:opacity-30 hover:bg-slate-50 shadow-sm"
            >
              <ChevronLeft size={16} />
            </button>
            <button 
              disabled={pagination.page === pagination.totalPages || loading}
              onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
              className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 disabled:opacity-30 hover:bg-slate-50 shadow-sm"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {municipes.length === 0 && !loading && (
          <div className="p-20 text-center">
            <Users size={40} className="text-slate-200 mx-auto mb-3" />
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Nenhum registro encontrado</h3>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-900">Novo Munícipe</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleCreateMunicipe} className="p-8 space-y-5">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Nome Completo</label>
                <input required type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm" placeholder="Ex: Maria da Silva" value={createForm.name} onChange={e => setCreateForm({...createForm, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">WhatsApp</label>
                  <input required type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm" placeholder="(43) 99999-9999" value={displayCreatePhone} onChange={e => applyPhoneMask(e.target.value, 'create')} />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Nascimento</label>
                  <input type="date" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm" value={createForm.birthDate} onChange={e => setCreateForm({...createForm, birthDate: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Bairro</label>
                <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm" placeholder="Ex: Centro" value={createForm.bairro} onChange={e => setCreateForm({...createForm, bairro: e.target.value})} />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="flex-1 px-6 py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-2xl transition-all">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-2xl font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50">
                  {saving ? 'Salvando...' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingMunicipe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-900">Editar Munícipe</h3>
              <button onClick={() => setEditingMunicipe(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            
            <div className="p-8 space-y-5">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Nome Completo</label>
                <input 
                  type="text"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-sm"
                  value={editForm.name}
                  onChange={e => setEditForm({...editForm, name: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">WhatsApp</label>
                  <input 
                    type="text"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-sm"
                    value={displayEditPhone}
                    onChange={e => applyPhoneMask(e.target.value, 'edit')}
                    placeholder="(43) 99999-9999"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Nascimento</label>
                  <input 
                    type="date"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-sm"
                    value={editForm.birthDate}
                    onChange={e => setEditForm({...editForm, birthDate: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Bairro</label>
                <input 
                  type="text"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-sm"
                  value={editForm.bairro}
                  onChange={e => setEditForm({...editForm, bairro: e.target.value})}
                />
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button 
                onClick={() => setEditingMunicipe(null)}
                className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveEdit}
                disabled={saving}
                className="bg-blue-600 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-900">Importar Munícipes (CSV)</h3>
              <button onClick={() => setIsImportModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={20} className="text-slate-500" /></button>
            </div>
            <div className="p-8 space-y-6">
              {!csvFile ? (
                <div className="border-2 border-dashed border-slate-200 rounded-[2rem] p-12 text-center hover:border-blue-400 transition-colors group cursor-pointer relative">
                  <input type="file" accept=".csv" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                  <div className="bg-blue-50 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <Upload className="text-blue-600" size={32} />
                  </div>
                  <h4 className="text-lg font-black text-slate-900">Selecione o arquivo CSV</h4>
                  <p className="text-sm text-slate-500 mt-1 font-medium">Clique ou arraste o arquivo para esta área.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-white p-2 rounded-lg text-blue-600 shadow-sm"><FileDown size={20} /></div>
                      <span className="text-sm font-bold text-blue-900">{csvFile.name}</span>
                    </div>
                    <button onClick={() => { setCsvFile(null); setCsvHeaders([]); }} className="text-red-500 hover:text-red-700"><X size={18} /></button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 bg-slate-50 p-6 rounded-3xl border border-slate-200">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Mapeamento de Colunas</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase ml-1 mb-1">Coluna: NOME</label>
                        <select className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" value={mapping.name} onChange={e => setMapping({...mapping, name: e.target.value})}>
                          <option value="">Selecionar...</option>
                          {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase ml-1 mb-1">Coluna: WHATSAPP</label>
                        <select className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" value={mapping.phone} onChange={e => setMapping({...mapping, phone: e.target.value})}>
                          <option value="">Selecionar...</option>
                          {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase ml-1 mb-1">Coluna: NASCIMENTO (Opcional)</label>
                        <select className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" value={mapping.birthDate} onChange={e => setMapping({...mapping, birthDate: e.target.value})}>
                          <option value="">Selecionar...</option>
                          {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase ml-1 mb-1">Coluna: BAIRRO (Opcional)</label>
                        <select className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" value={mapping.bairro} onChange={e => setMapping({...mapping, bairro: e.target.value})}>
                          <option value="">Selecionar...</option>
                          {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setIsImportModalOpen(false)} className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-all">Cancelar</button>
              <button onClick={handleImportCSV} disabled={saving || !csvFile} className="bg-blue-600 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2">
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                Iniciar Importação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Broadcast Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-900">Disparo Segmentado</h3>
              <button onClick={() => !sending && setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-sm text-blue-800">
                  Você está enviando uma mensagem para <strong>{selectedMunicipes.length}</strong> munícipes
                  {selectedBairro ? ` do bairro ` : ''} 
                  {selectedBairro && <strong className="text-blue-900">{selectedBairro}</strong>}.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <label className="block text-sm font-bold text-slate-700">Mensagem</label>
                  <span className="text-[10px] font-black text-blue-500 uppercase tracking-tighter bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                    Dica: Use {"{{nome}}"} para personalizar
                  </span>
                </div>
                <textarea 
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  rows={5}
                  placeholder="Olá {{nome}}! Gostaria de informar sobre as obras na nossa região..."
                  value={broadcastMessage}
                  onChange={e => setBroadcastMessage(e.target.value)}
                  disabled={sending}
                />
              </div>

              {sending && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-widest">
                    <span>Enviando mensagens...</span>
                    <span>{sendProgress.current} / {sendProgress.total}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-600 transition-all duration-300"
                      style={{ width: `${(sendProgress.current / sendProgress.total) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button 
                onClick={() => setIsModalOpen(false)}
                disabled={sending}
                className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSendBroadcast}
                disabled={sending || !broadcastMessage.trim()}
                className="bg-blue-600 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2"
              >
                {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                {sending ? 'Processando...' : 'Iniciar Disparo'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Export Modal */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900">Exportar PDF</h3>
              <button onClick={() => setIsExportModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={18} className="text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <button 
                onClick={() => exportToPDF('page')}
                disabled={exporting}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-left hover:border-blue-500 hover:bg-blue-50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-white p-2 rounded-xl text-slate-400 group-hover:text-blue-600 shadow-sm transition-colors">
                    <FileDown size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">Página Atual</p>
                    <p className="text-xs text-slate-500">Exportar apenas os {municipes.length} registros visíveis</p>
                  </div>
                </div>
              </button>

              <button 
                onClick={() => exportToPDF('all')}
                disabled={exporting}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-left hover:border-blue-500 hover:bg-blue-50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-white p-2 rounded-xl text-slate-400 group-hover:text-blue-600 shadow-sm transition-colors">
                    <Users size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">Banco Completo</p>
                    <p className="text-xs text-slate-500">Exportar todos os {pagination.total} registros</p>
                  </div>
                </div>
              </button>
            </div>
            {exporting && (
              <div className="px-6 pb-6 text-center">
                <div className="flex items-center justify-center gap-2 text-blue-600 font-bold text-sm">
                  <Loader2 className="animate-spin" size={16} />
                  Gerando relatório...
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

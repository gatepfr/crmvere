import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { formatPhone } from '../../utils/formatPhone';
import {
  Users, Search, Loader2, Send, X, ArrowUpDown, ArrowUp, ArrowDown,
  FileDown, Star, Edit2, Trash2, Plus, Upload, ChevronLeft, ChevronRight,
  Check, FileText, Gavel, MessageSquare
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface Municipe {
  id: string; name: string; phone: string; cep?: string | null;
  bairro: string | null; birthDate: string | null; isLideranca: boolean;
  createdAt: string; demandCount: number; documentCount: number; indicacaoCount: number;
}

interface Pagination { page: number; limit: number; total: number; totalPages: number; }

interface CabinetConfig {
  name: string; municipio: string; uf: string; partido: string;
  mandato: string; fotoUrl: string; calendarUrl: string;
  birthdayMessage: string; birthdayAutomated: boolean; legislativeMessage: string;
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
  const [selectedMunicipes, setSelectedMunicipes] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: 'name' | 'phone' | 'bairro' | 'createdAt' | 'demandCount'; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [allBairros, setAllBairros] = useState<string[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0 });
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', phone: '', cep: '', bairro: '', birthDate: '', isLideranca: false });
  const [displayCreatePhone, setDisplayCreatePhone] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState({ name: '', phone: '', bairro: '', birthDate: '' });
  const [editingMunicipe, setEditingMunicipe] = useState<Municipe | null>(null);
  const [editForm, setEditForm] = useState({ name: '', phone: '', cep: '', bairro: '', birthDate: '', isLideranca: false });
  const [displayEditPhone, setDisplayEditPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadAllBairros = useCallback(async () => {
    try { const res = await api.get('/demands/municipes/bairros'); setAllBairros(res.data || []); } catch { }
  }, []);

  const loadMunicipes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(), limit: pagination.limit.toString(),
        search: searchTerm, bairro: selectedBairro,
        lideranca: onlyLideranca.toString(), birthday: onlyBirthdays.toString(),
        sortBy: sortConfig.key, sortOrder: sortConfig.direction
      });
      const res = await api.get(`/demands/municipes/list?${params.toString()}`);
      setMunicipes(res.data.data || []);
      setPagination(res.data.pagination || { page: 1, limit: 25, total: 0, totalPages: 0 });
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [pagination.page, pagination.limit, searchTerm, selectedBairro, onlyLideranca, onlyBirthdays, sortConfig]);

  useEffect(() => { loadMunicipes(); }, [loadMunicipes]);
  useEffect(() => { loadAllBairros(); }, [loadAllBairros]);
  useEffect(() => { api.get('/config/me').then(res => setCabinetConfig(res.data)).catch(() => {}); }, []);
  useEffect(() => { setPagination(prev => ({ ...prev, page: 1 })); }, [searchTerm, selectedBairro, onlyLideranca, onlyBirthdays]);

  const isTodayBirthday = (dateStr: string | null) => {
    if (!dateStr) return false;
    try {
      const today = new Date();
      const brParts = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }).formatToParts(today);
      const todayDay = brParts.find(p => p.type === 'day')?.value;
      const todayMonth = brParts.find(p => p.type === 'month')?.value;
      const [, m, d] = dateStr.split('T')[0].split('-');
      return d === todayDay && m === todayMonth;
    } catch { return false; }
  };

  const handleSort = (key: typeof sortConfig.key) => {
    setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
  };

  const SortIcon = ({ col }: { col: typeof sortConfig.key }) =>
    sortConfig.key === col
      ? sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
      : <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-60" />;

  const toggleSelect = (id: string) =>
    setSelectedMunicipes(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const toggleSelectAll = () =>
    setSelectedMunicipes(selectedMunicipes.length === municipes.length && municipes.length > 0 ? [] : municipes.map(m => m.id));

  const handleCreateMunicipe = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      await api.post('/demands/municipes', { ...createForm, birthDate: parseDateToISO(createForm.birthDate) });
      setIsCreateModalOpen(false);
      setCreateForm({ name: '', phone: '', cep: '', bairro: '', birthDate: '', isLideranca: false });
      setDisplayCreatePhone('');
      loadMunicipes();
      toast.success('Munícipe cadastrado com sucesso!');
    } catch (err: any) { toast.error(err.response?.data?.error || 'Erro ao cadastrar.'); }
    finally { setSaving(false); }
  };

  const handleToggleLideranca = async (m: Municipe) => {
    try {
      await api.patch(`/demands/municipes/${m.id}`, { isLideranca: !m.isLideranca });
      setMunicipes(prev => prev.map(p => p.id === m.id ? { ...p, isLideranca: !p.isLideranca } : p));
    } catch { toast.error('Erro ao atualizar status.'); }
  };

  const handleBulkLideranca = async () => {
    if (!selectedMunicipes.length || !confirm(`Tornar ${selectedMunicipes.length} munícipes como Liderança?`)) return;
    setSaving(true);
    try {
      for (const id of selectedMunicipes) await api.patch(`/demands/municipes/${id}`, { isLideranca: true });
      setSelectedMunicipes([]); loadMunicipes(); toast.success('Lideranças atualizadas!');
    } catch { toast.error('Erro na atualização em massa.'); }
    finally { setSaving(false); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const first = text.split('\n')[0];
      const delim = first.includes(';') ? ';' : ',';
      setCsvHeaders(first.split(delim).map(h => h.trim().replace(/"/g, '')));
    };
    reader.readAsText(file);
  };

  const handleImportCSV = async () => {
    if (!csvFile || !mapping.name || !mapping.phone) { toast.warning('Selecione arquivo e mapeie Nome e Telefone.'); return; }
    setSaving(true);
    const fd = new FormData();
    fd.append('file', csvFile); fd.append('mapping', JSON.stringify(mapping));
    try {
      await api.post('/demands/municipes/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setIsImportModalOpen(false); setCsvFile(null); setCsvHeaders([]); loadMunicipes(); toast.success('Importação concluída!');
    } catch (err: any) { toast.error('Falha: ' + (err.response?.data?.error || 'Erro desconhecido')); }
    finally { setSaving(false); }
  };

  const handleSendBirthdayMessage = async (m: Municipe) => {
    let msg = (cabinetConfig?.birthdayMessage || `Olá ${m.name}, parabéns pelo seu aniversário! 🎂🎈`).replace(/{nome}/g, m.name);
    try { await api.post('/whatsapp/send-direct', { phone: m.phone, message: msg }); toast.success('Mensagem enviada!'); }
    catch (err: any) { toast.error(`Falha: ${err.response?.data?.error || 'Verifique a conexão'}`); }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastMessage.trim()) return;
    setSending(true); setSendProgress({ current: 0, total: selectedMunicipes.length });
    let failed = 0;
    for (let i = 0; i < selectedMunicipes.length; i++) {
      const m = municipes.find(x => x.id === selectedMunicipes[i]);
      if (m) { try { await api.post('/whatsapp/send-direct', { phone: m.phone, message: broadcastMessage.replace(/{{nome}}/g, m.name) }); } catch { failed++; } }
      setSendProgress(prev => ({ ...prev, current: i + 1 }));
      await new Promise(r => setTimeout(r, 500));
    }
    setSending(false); setIsModalOpen(false); setBroadcastMessage(''); setSelectedMunicipes([]);
    toast.success(failed > 0 ? `${selectedMunicipes.length - failed} enviadas, ${failed} falharam.` : 'Enviadas com sucesso!');
  };

  const formatDateDisplay = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try { const [y, m, d] = dateStr.split('T')[0].split('-'); return `${d}/${m}/${y}`; } catch { return '—'; }
  };

  const applyDateMask = (v: string) => {
    const r = v.replace(/\D/g, '').slice(0, 8);
    if (r.length > 4) return `${r.slice(0, 2)}/${r.slice(2, 4)}/${r.slice(4, 8)}`;
    if (r.length > 2) return `${r.slice(0, 2)}/${r.slice(2, 4)}`;
    return r;
  };

  const parseDateToISO = (s: string) => {
    if (!s || s.length !== 10) return null;
    const [d, m, y] = s.split('/'); return `${y}-${m}-${d}`;
  };

  const applyPhoneMask = (value: string, type: 'create' | 'edit') => {
    const raw = value.replace(/\D/g, '').slice(0, 11);
    let masked = raw;
    if (raw.length > 2) masked = `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
    if (raw.length > 7) masked = `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7, 11)}`;
    if (type === 'create') { setDisplayCreatePhone(masked); setCreateForm(p => ({ ...p, phone: raw.startsWith('55') ? raw : `55${raw}` })); }
    else { setDisplayEditPhone(masked); setEditForm(p => ({ ...p, phone: raw.startsWith('55') ? raw : `55${raw}` })); }
  };

  const handleCepChange = async (value: string, type: 'create' | 'edit') => {
    const raw = value.replace(/\D/g, '').substring(0, 8);
    const masked = raw.length > 5 ? `${raw.slice(0, 5)}-${raw.slice(5)}` : raw;
    if (type === 'create') setCreateForm(p => ({ ...p, cep: masked }));
    else setEditForm(p => ({ ...p, cep: masked }));
    if (raw.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
        const d = await res.json();
        if (!d.erro && d.bairro) {
          if (type === 'create') setCreateForm(p => ({ ...p, bairro: d.bairro.toUpperCase() }));
          else setEditForm(p => ({ ...p, bairro: d.bairro.toUpperCase() }));
        }
      } catch { }
    }
  };

  const handleEdit = (m: Municipe) => {
    setEditingMunicipe(m);
    setEditForm({ name: m.name, phone: m.phone, cep: m.cep || '', bairro: m.bairro || '', birthDate: m.birthDate ? formatDateDisplay(m.birthDate) : '', isLideranca: m.isLideranca });
    setDisplayEditPhone(formatPhone(m.phone));
  };

  const handleSaveEdit = async () => {
    if (!editingMunicipe) return;
    setSaving(true);
    try {
      await api.patch(`/demands/municipes/${editingMunicipe.id}`, { ...editForm, birthDate: parseDateToISO(editForm.birthDate) });
      setEditingMunicipe(null); toast.success('Dados atualizados!'); loadMunicipes();
    } catch { toast.error('Falha ao atualizar.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir este munícipe?')) return;
    try { await api.delete(`/demands/municipes/${id}`); setMunicipes(prev => prev.filter(m => m.id !== id)); toast.success('Excluído!'); }
    catch { toast.error('Falha ao excluir.'); }
  };

  const exportToPDF = async (mode: 'page' | 'all') => {
    setExporting(true);
    try {
      let data = municipes;
      if (mode === 'all') { const res = await api.get(`/demands/municipes/list?limit=all&sortBy=${sortConfig.key}&sortOrder=${sortConfig.direction}`); data = res.data.data; }
      const doc = new jsPDF();
      doc.setFillColor(30, 41, 59); doc.rect(0, 0, 210, 40, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(22); doc.setFont('helvetica', 'bold');
      doc.text('RELATÓRIO DE MUNÍCIPES', 14, 20); doc.setFontSize(10);
      doc.text('CRM DO VERÊ - GESTÃO DE GABINETE', 14, 28);
      doc.text(`GERADO EM: ${new Date().toLocaleString('pt-BR')}`, 140, 28);
      autoTable(doc, {
        startY: 45, head: [['NOME', 'WHATSAPP', 'BAIRRO', 'NASCIMENTO', 'DEMANDAS']],
        body: data.map(m => [m.name, formatPhone(m.phone), m.bairro || '—', formatDateDisplay(m.birthDate), m.demandCount.toString()]),
        theme: 'striped', headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 10, fontStyle: 'bold' },
      });
      doc.save(`municipes-${mode}-${Date.now()}.pdf`); setIsExportModalOpen(false);
    } catch { toast.error('Erro ao exportar'); }
    finally { setExporting(false); }
  };

  const inputCls = 'w-full px-4 py-3 bg-muted border border-border rounded-xl font-medium text-sm outline-none focus:ring-2 focus:ring-ring transition-all text-foreground placeholder:text-muted-foreground';

  return (
    <div className="space-y-5 animate-in fade-in duration-500">

      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
            <Users className="text-primary" size={28} /> Munícipes
          </h1>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mt-1">Base de eleitores e lideranças</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2">
            <Plus size={16} /> Adicionar
          </Button>
          {(user?.role === 'admin' || user?.role === 'vereador') && (
            <Button variant="outline" onClick={() => setIsImportModalOpen(true)} className="gap-2">
              <Upload size={16} /> Importar
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={() => setIsExportModalOpen(true)} title="Exportar PDF">
            <FileDown size={18} />
          </Button>
        </div>
      </header>

      {/* Filter bar */}
      <Card>
        <CardContent className="p-3 flex flex-col xl:flex-row items-stretch xl:items-center gap-3">
          <div className="relative flex-1 group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={15} />
            <input
              type="text"
              placeholder="Buscar por nome ou telefone..."
              className="w-full pl-10 pr-4 py-2.5 bg-muted border border-transparent rounded-lg outline-none focus:bg-background focus:border-border transition-all text-sm font-medium text-foreground placeholder:text-muted-foreground"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="pl-3 pr-8 py-2.5 bg-muted border border-transparent rounded-lg outline-none text-sm font-medium text-foreground min-w-[150px] focus:border-border transition-all"
              value={selectedBairro}
              onChange={e => setSelectedBairro(e.target.value)}
            >
              <option value="">Todos os bairros</option>
              {allBairros.sort().map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <button
              onClick={() => setOnlyLideranca(!onlyLideranca)}
              className={cn(
                'px-4 py-2.5 rounded-lg text-[10px] font-semibold uppercase tracking-widest transition-all border',
                onlyLideranca ? 'bg-amber-500 border-amber-400 text-white shadow-sm' : 'bg-muted border-transparent text-muted-foreground hover:bg-muted/80'
              )}
            >Lideranças</button>
            <button
              onClick={() => setOnlyBirthdays(!onlyBirthdays)}
              className={cn(
                'px-4 py-2.5 rounded-lg text-[10px] font-semibold uppercase tracking-widest transition-all border',
                onlyBirthdays ? 'bg-pink-500 border-pink-400 text-white shadow-sm' : 'bg-muted border-transparent text-muted-foreground hover:bg-muted/80'
              )}
            >🎂 Hoje</button>
            <select
              className="px-3 py-2.5 bg-muted border border-transparent text-muted-foreground rounded-lg outline-none text-xs font-medium focus:border-border transition-all"
              value={pagination.limit === 10000 ? 'all' : pagination.limit}
              onChange={e => setPagination(p => ({ ...p, limit: e.target.value === 'all' ? 10000 : parseInt(e.target.value), page: 1 }))}
            >
              <option value="25">25 / pág</option>
              <option value="50">50 / pág</option>
              <option value="100">100 / pág</option>
              <option value="all">Ver todos</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Selection bar */}
      {selectedMunicipes.length > 0 && (
        <div className="bg-primary text-primary-foreground px-4 py-3 rounded-xl flex items-center justify-between shadow-md animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-1.5 rounded-lg"><Check size={16} strokeWidth={3} /></div>
            <span className="font-semibold text-sm">{selectedMunicipes.length} selecionados</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="text-primary-foreground hover:bg-white/10 hover:text-primary-foreground" onClick={() => setSelectedMunicipes([])}>Desmarcar</Button>
            <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white gap-1.5 border-0" onClick={handleBulkLideranca}><Star size={14} fill="currentColor" /> Liderança</Button>
            <Button size="sm" className="bg-white text-primary hover:bg-white/90 gap-1.5 border-0" onClick={() => setIsModalOpen(true)}><MessageSquare size={14} /> WhatsApp</Button>
          </div>
        </div>
      )}

      {/* Table */}
      <Card className="overflow-hidden relative">
        {loading && (
          <div className="absolute inset-0 bg-background/60 z-10 flex items-center justify-center">
            <Loader2 className="animate-spin text-primary" size={28} />
          </div>
        )}
        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-border">
          {municipes.length === 0 && !loading ? (
            <p className="py-16 text-center text-muted-foreground text-xs uppercase tracking-widest font-semibold">Nenhum munícipe encontrado</p>
          ) : municipes.map(m => (
            <div key={m.id} className="p-4 flex items-center gap-3 cursor-pointer active:bg-muted/50" onClick={() => handleEdit(m)}>
              <button
                onClick={e => { e.stopPropagation(); handleToggleLideranca(m); }}
                className={cn('w-10 h-10 rounded-xl flex items-center justify-center font-semibold text-base shrink-0', m.isLideranca ? 'bg-amber-100 text-amber-600 border border-amber-200' : 'bg-muted text-muted-foreground')}
              >
                {m.isLideranca ? <Star size={18} fill="currentColor" /> : m.name.charAt(0).toUpperCase()}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-foreground">{m.name}</span>
                  {m.isLideranca && <Badge variant="secondary" className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0">Liderança</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{formatPhone(m.phone)}</p>
                {m.bairro && <p className="text-[10px] text-muted-foreground uppercase font-semibold mt-0.5">{m.bairro}</p>}
              </div>
              <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                {isTodayBirthday(m.birthDate) && (
                  <button onClick={() => handleSendBirthdayMessage(m)} className="w-8 h-8 flex items-center justify-center bg-pink-50 hover:bg-pink-100 rounded-lg text-base" title="Parabéns">🎈</button>
                )}
                <button onClick={() => handleEdit(m)} className="p-2 text-muted-foreground hover:text-primary rounded-lg transition-colors"><Edit2 size={15} /></button>
                <button onClick={() => handleDelete(m.id)} className="p-2 text-muted-foreground hover:text-destructive rounded-lg transition-colors"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-12 text-center pl-5">
                  <div
                    onClick={toggleSelectAll}
                    className={cn(
                      'mx-auto w-5 h-5 rounded-md border-2 flex items-center justify-center cursor-pointer transition-all',
                      selectedMunicipes.length === municipes.length && municipes.length > 0
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'bg-background border-border'
                    )}
                  >
                    {selectedMunicipes.length === municipes.length && municipes.length > 0 && <Check size={11} strokeWidth={3} />}
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer group w-[220px]" onClick={() => handleSort('name')}>
                  <div className="flex items-center gap-1.5">Munícipe <SortIcon col="name" /></div>
                </TableHead>
                <TableHead className="cursor-pointer group w-[280px]" onClick={() => handleSort('bairro')}>
                  <div className="flex items-center gap-1.5">Bairro <SortIcon col="bairro" /></div>
                </TableHead>
                <TableHead className="text-center">Nascimento</TableHead>
                <TableHead className="text-right pr-5">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {municipes.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-20 text-center text-muted-foreground text-xs uppercase tracking-widest font-semibold">
                    Nenhum munícipe encontrado
                  </TableCell>
                </TableRow>
              ) : municipes.map(m => (
                <TableRow
                  key={m.id}
                  className={cn('cursor-pointer', selectedMunicipes.includes(m.id) && 'bg-primary/5')}
                  onClick={() => handleEdit(m)}
                >
                  <TableCell className="pl-5" onClick={e => e.stopPropagation()}>
                    <div
                      onClick={() => toggleSelect(m.id)}
                      className={cn(
                        'mx-auto w-5 h-5 rounded-md border-2 flex items-center justify-center cursor-pointer transition-all',
                        selectedMunicipes.includes(m.id) ? 'bg-primary border-primary text-primary-foreground' : 'bg-background border-border'
                      )}
                    >
                      {selectedMunicipes.includes(m.id) && <Check size={11} strokeWidth={3} />}
                    </div>
                  </TableCell>
                  <TableCell className="w-[220px]">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={e => { e.stopPropagation(); handleToggleLideranca(m); }}
                        className={cn(
                          'w-9 h-9 rounded-xl flex items-center justify-center font-semibold text-base transition-all hover:scale-110 active:scale-95 shrink-0',
                          m.isLideranca ? 'bg-amber-100 text-amber-600 border border-amber-200' : 'bg-muted text-muted-foreground hover:bg-amber-50 hover:text-amber-400'
                        )}
                      >
                        {m.isLideranca ? <Star size={18} fill="currentColor" /> : m.name.charAt(0).toUpperCase()}
                      </button>
                      <div>
                        <div className="font-semibold text-foreground flex items-center gap-1.5 flex-wrap">
                          {m.name}
                          {m.isLideranca && <Badge variant="secondary" className="text-[9px] bg-amber-100 text-amber-700 border-amber-200 px-1.5 py-0">Liderança</Badge>}
                          {m.documentCount > 0 && (
                            <Badge variant="secondary" className="text-[9px] bg-primary/10 text-primary px-1.5 py-0 gap-0.5">
                              <FileText size={8} />{m.documentCount} doc{m.documentCount !== 1 ? 's' : ''}
                            </Badge>
                          )}
                          {m.indicacaoCount > 0 && (
                            <Badge variant="secondary" className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0 gap-0.5">
                              <Gavel size={8} />{m.indicacaoCount} ind.
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatPhone(m.phone)}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs font-medium text-muted-foreground uppercase w-[280px]">{m.bairro || '—'}</TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">{formatDateDisplay(m.birthDate)}</TableCell>
                  <TableCell className="pr-5" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      {isTodayBirthday(m.birthDate) && (
                        <button onClick={() => handleSendBirthdayMessage(m)} className="w-8 h-8 flex items-center justify-center bg-pink-50 hover:bg-pink-100 rounded-lg animate-pulse text-base" title="Parabéns">🎈</button>
                      )}
                      <button onClick={() => handleEdit(m)} className="p-2 text-muted-foreground hover:text-primary rounded-lg transition-colors"><Edit2 size={15} /></button>
                      <button onClick={() => handleDelete(m.id)} className="p-2 text-muted-foreground hover:text-destructive rounded-lg transition-colors"><Trash2 size={15} /></button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="px-5 py-3 bg-muted/30 border-t border-border flex justify-between items-center">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
            {pagination.total} munícipes · pág. {pagination.page}/{pagination.totalPages}
          </p>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={pagination.page === 1} onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}>
              <ChevronLeft size={15} />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={pagination.page === pagination.totalPages} onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}>
              <ChevronRight size={15} />
            </Button>
          </div>
        </div>
      </Card>

      {/* ── Modals ── */}

      {/* Broadcast */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-border">
            <div className="px-6 py-5 border-b border-border flex justify-between items-center">
              <h3 className="text-lg font-semibold text-foreground">Disparo em Massa</h3>
              <button onClick={() => !sending && setIsModalOpen(false)} className="p-1.5 hover:bg-muted rounded-lg transition-colors text-muted-foreground"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                <p className="text-sm text-primary">Enviando para <strong>{selectedMunicipes.length}</strong> contatos.</p>
              </div>
              <textarea
                className="w-full bg-muted border border-border rounded-xl p-4 text-sm focus:ring-2 focus:ring-ring outline-none text-foreground placeholder:text-muted-foreground resize-none"
                rows={5} placeholder="Olá {{nome}}! ..." value={broadcastMessage}
                onChange={e => setBroadcastMessage(e.target.value)} disabled={sending}
              />
              {sending && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                    <span>Enviando...</span><span>{sendProgress.current}/{sendProgress.total}</span>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary transition-all duration-300" style={{ width: `${(sendProgress.current / sendProgress.total) * 100}%` }} />
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-muted/50 border-t border-border flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setIsModalOpen(false)} disabled={sending}>Cancelar</Button>
              <Button onClick={handleSendBroadcast} disabled={sending || !broadcastMessage.trim()} className="gap-2">
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {sending ? 'Processando...' : 'Iniciar Disparo'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Export */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-border">
            <div className="px-6 py-5 border-b border-border flex justify-between items-center">
              <h3 className="text-lg font-semibold text-foreground">Exportar PDF</h3>
              <button onClick={() => setIsExportModalOpen(false)} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-2">
              {[
                { mode: 'page' as const, icon: <FileDown size={18} />, label: 'Página Atual', sub: `${municipes.length} registros visíveis` },
                { mode: 'all' as const, icon: <Users size={18} />, label: 'Banco Completo', sub: `Todos os ${pagination.total} registros` },
              ].map(opt => (
                <button key={opt.mode} onClick={() => exportToPDF(opt.mode)} disabled={exporting}
                  className="w-full p-4 bg-muted border border-border rounded-xl text-left hover:border-primary hover:bg-primary/5 transition-all group flex items-center gap-3">
                  <div className="bg-background p-2 rounded-lg text-muted-foreground group-hover:text-primary shadow-xs transition-colors">{opt.icon}</div>
                  <div><p className="font-semibold text-foreground text-sm">{opt.label}</p><p className="text-xs text-muted-foreground mt-0.5">{opt.sub}</p></div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit */}
      {(isCreateModalOpen || editingMunicipe) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-border">
            <div className="px-6 py-5 border-b border-border flex justify-between items-center">
              <h3 className="text-lg font-semibold text-foreground">{editingMunicipe ? 'Editar' : 'Novo'} Munícipe</h3>
              <button onClick={() => { setIsCreateModalOpen(false); setEditingMunicipe(null); }} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground"><X size={18} /></button>
            </div>
            <form onSubmit={editingMunicipe ? (e) => { e.preventDefault(); handleSaveEdit(); } : handleCreateMunicipe} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Nome Completo</label>
                <input required type="text" className={inputCls} value={editingMunicipe ? editForm.name : createForm.name} onChange={e => editingMunicipe ? setEditForm({ ...editForm, name: e.target.value }) : setCreateForm({ ...createForm, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">WhatsApp</label>
                  <input required type="text" className={inputCls} value={editingMunicipe ? displayEditPhone : displayCreatePhone} onChange={e => applyPhoneMask(e.target.value, editingMunicipe ? 'edit' : 'create')} />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Nascimento</label>
                  <input type="text" className={inputCls} placeholder="DD/MM/AAAA" maxLength={10} value={editingMunicipe ? editForm.birthDate : createForm.birthDate} onChange={e => editingMunicipe ? setEditForm({ ...editForm, birthDate: applyDateMask(e.target.value) }) : setCreateForm({ ...createForm, birthDate: applyDateMask(e.target.value) })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">CEP</label>
                  <input type="text" className={inputCls} placeholder="00000-000" maxLength={9} value={editingMunicipe ? editForm.cep : createForm.cep} onChange={e => handleCepChange(e.target.value, editingMunicipe ? 'edit' : 'create')} />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Bairro</label>
                  <input type="text" className={inputCls} value={editingMunicipe ? editForm.bairro : createForm.bairro} onChange={e => editingMunicipe ? setEditForm({ ...editForm, bairro: e.target.value.toUpperCase() }) : setCreateForm({ ...createForm, bairro: e.target.value.toUpperCase() })} />
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-100 rounded-xl">
                <div className="flex items-center gap-2">
                  <Star className={(editingMunicipe ? editForm.isLideranca : createForm.isLideranca) ? 'text-amber-500' : 'text-muted-foreground'} size={18} fill={(editingMunicipe ? editForm.isLideranca : createForm.isLideranca) ? 'currentColor' : 'none'} />
                  <span className="text-xs font-semibold text-foreground">Marcar como Liderança</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={editingMunicipe ? editForm.isLideranca : createForm.isLideranca} onChange={e => editingMunicipe ? setEditForm({ ...editForm, isLideranca: e.target.checked }) : setCreateForm({ ...createForm, isLideranca: e.target.checked })} />
                  <div className="w-10 h-5 bg-muted rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500" />
                </label>
              </div>
              <Button type="submit" disabled={saving} className="w-full">
                {saving ? 'Salvando...' : editingMunicipe ? 'Salvar Alterações' : 'Cadastrar Munícipe'}
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Import */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-border">
            <div className="px-6 py-5 border-b border-border flex justify-between items-center">
              <h3 className="text-lg font-semibold text-foreground">Importar Munícipes (CSV)</h3>
              <button onClick={() => !saving && setIsImportModalOpen(false)} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-5">
              <label className="p-6 bg-muted border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all relative">
                <input type="file" accept=".csv" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                <Upload className="text-primary mb-2" size={28} />
                <p className="text-sm font-semibold text-foreground">{csvFile ? csvFile.name : 'Clique para selecionar CSV'}</p>
                <p className="text-[10px] text-muted-foreground uppercase mt-1 tracking-widest">Semicólon ou vírgula aceitos</p>
              </label>
              {csvHeaders.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Coluna do Nome', key: 'name', required: true },
                    { label: 'Coluna do WhatsApp', key: 'phone', required: true },
                    { label: 'Coluna do Bairro', key: 'bairro', required: false },
                    { label: 'Coluna de Nascimento', key: 'birthDate', required: false },
                  ].map(field => (
                    <div key={field.key}>
                      <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">{field.label}</label>
                      <select className="w-full p-2.5 bg-muted border border-border rounded-lg text-xs font-medium text-foreground" value={mapping[field.key as keyof typeof mapping]} onChange={e => setMapping({ ...mapping, [field.key]: e.target.value })}>
                        <option value="">{field.required ? 'Selecione...' : 'Não importar'}</option>
                        {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-muted/50 border-t border-border flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setIsImportModalOpen(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={handleImportCSV} disabled={saving || !csvFile || !mapping.name || !mapping.phone}>
                {saving ? 'Importando...' : 'Iniciar Importação'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

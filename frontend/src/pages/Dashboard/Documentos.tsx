import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import api from '../../api/client';
import { Plus, Search, Loader2, Edit2, Trash2, X, ExternalLink, File, FileDown, ChevronLeft, ChevronRight, Users, MapPin, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface MunicipeResult { id: string; name: string; phone: string; bairro: string | null; }

interface Documento {
  documento: {
    id: string;
    tipo: string;
    categoria: string | null;
    descricao: string | null;
    origem: string;
    status: string;
    numeroDocumento: string | null;
    documentUrl: string | null;
    createdAt: string;
    updatedAt: string;
  };
  municipe: { id: string; name: string; phone: string; bairro: string | null } | null;
}

interface Pagination { page: number; limit: number; total: number; totalPages: number; }

const TIPO_LABELS: Record<string, string> = {
  oficio: 'Ofício',
  requerimento: 'Requerimento',
  projeto_lei: 'Proj. Lei',
  encaminhamento_formal: 'Encaminhamento',
  outro: 'Outro',
};

const TIPO_COLORS: Record<string, string> = {
  oficio: 'bg-blue-50 text-blue-600 border-blue-100',
  requerimento: 'bg-purple-50 text-purple-600 border-purple-100',
  projeto_lei: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  encaminhamento_formal: 'bg-amber-50 text-amber-600 border-amber-100',
  outro: 'bg-slate-50 text-slate-500 border-slate-100',
};

const TIPO_ROW_BG: Record<string, string> = {
  oficio: 'bg-blue-50/40',
  requerimento: 'bg-purple-50/40',
  projeto_lei: 'bg-emerald-50/40',
  encaminhamento_formal: 'bg-amber-50/40',
  outro: '',
};

const STATUS_COLORS: Record<string, string> = {
  criado: 'bg-slate-50 text-slate-500 border-slate-100',
  enviado: 'bg-blue-50 text-blue-600 border-blue-100',
  concluido: 'bg-green-50 text-green-600 border-green-100',
};

const STATUS_LABELS: Record<string, string> = {
  criado: 'Criado',
  enviado: 'Enviado',
  concluido: 'Concluído',
};

const emptyForm = {
  tipo: 'oficio',
  categoria: '',
  descricao: '',
  origem: 'gabinete',
  municipeId: '',
  municipeName: '',
  numeroDocumento: '',
  documentUrl: '',
  status: 'criado',
};


export default function Documentos() {
  const [docs, setDocs] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterOrigem, setFilterOrigem] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Documento | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [municipeSearch, setMunicipeSearch] = useState('');
  const [municipeResults, setMunicipeResults] = useState<MunicipeResult[]>([]);
  const [searchingMunicipe, setSearchingMunicipe] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [sortField, setSortField] = useState<'name' | 'date' | 'categoria'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const toggleSort = (field: 'name' | 'date' | 'categoria') => {
    if (sortField === field) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
  };

  const SortIcon = ({ field }: { field: 'name' | 'date' | 'categoria' }) => {
    if (sortField !== field) return <ArrowUpDown size={11} className="text-slate-300 group-hover:text-slate-400" />;
    return sortOrder === 'asc' ? <ArrowUp size={11} className="text-blue-600" /> : <ArrowDown size={11} className="text-blue-600" />;
  };

  const sortedDocs = useMemo(() => [...docs].sort((a, b) => {
    let valA: any, valB: any;
    if (sortField === 'name') { valA = a.municipe?.name?.toLowerCase() ?? ''; valB = b.municipe?.name?.toLowerCase() ?? ''; }
    else if (sortField === 'categoria') { valA = a.documento.categoria?.toLowerCase() ?? ''; valB = b.documento.categoria?.toLowerCase() ?? ''; }
    else { valA = new Date(a.documento.createdAt).getTime(); valB = new Date(b.documento.createdAt).getTime(); }
    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  }), [docs, sortField, sortOrder]);

  const fetchDocs = useCallback((isBackground = false) => {
    if (!isBackground) setLoading(true);
    const params = new URLSearchParams({
      page: pagination.page.toString(),
      limit: pagination.limit.toString(),
      search,
      ...(filterTipo && { tipo: filterTipo }),
      ...(filterStatus && { status: filterStatus }),
      ...(filterOrigem && { origem: filterOrigem }),
    });
    api.get(`/documentos?${params}`)
      .then(res => {
        setDocs(res.data.data || []);
        setPagination(res.data.pagination || { page: 1, limit: 25, total: 0, totalPages: 0 });
      })
      .catch(err => console.error(err))
      .finally(() => { if (!isBackground) setLoading(false); });
  }, [pagination.page, pagination.limit, search, filterTipo, filterStatus, filterOrigem]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  useEffect(() => {
    api.get('/demands/categories').then(res => setCategorias((res.data || []).map((c: { name: string }) => c.name).sort((a: string, b: string) => a.localeCompare(b, 'pt-BR')))).catch(() => {});
  }, []);

  const handleMunicipeSearch = async (term: string) => {
    setMunicipeSearch(term);
    setForm(f => ({ ...f, municipeId: '', municipeName: '' }));
    if (term.length < 3) { setMunicipeResults([]); return; }
    setSearchingMunicipe(true);
    try {
      const res = await api.get(`/demands/municipes/list?search=${term}&limit=5`);
      setMunicipeResults(res.data.data || []);
    } catch { setMunicipeResults([]); }
    finally { setSearchingMunicipe(false); }
  };

  const selectMunicipe = (m: MunicipeResult) => {
    setForm(f => ({ ...f, municipeId: m.id, municipeName: m.name }));
    setMunicipeSearch(m.name);
    setMunicipeResults([]);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setMunicipeSearch('');
    setMunicipeResults([]);
    setModalOpen(true);
  };

  const openEdit = (d: Documento) => {
    setEditing(d);
    setForm({
      tipo: d.documento.tipo,
      categoria: d.documento.categoria || '',
      descricao: d.documento.descricao || '',
      origem: d.documento.origem,
      municipeId: d.municipe?.id || '',
      municipeName: d.municipe?.name || '',
      numeroDocumento: d.documento.numeroDocumento || '',
      documentUrl: d.documento.documentUrl || '',
      status: d.documento.status,
    });
    setMunicipeSearch(d.municipe?.name || '');
    setMunicipeResults([]);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.categoria.trim()) { toast.warning('Categoria é obrigatória'); return; }
    if (form.origem === 'municipe' && !form.municipeId) { toast.warning('Selecione um munícipe'); return; }
    setSaving(true);
    try {
      const payload = {
        tipo: form.tipo,
        categoria: form.categoria,
        descricao: form.descricao || null,
        origem: form.origem,
        municipeId: form.origem === 'municipe' ? form.municipeId : null,
        numeroDocumento: form.numeroDocumento || null,
        documentUrl: form.documentUrl || null,
        status: form.status,
      };
      if (editing) {
        await api.patch(`/documentos/${editing.documento.id}`, payload);
      } else {
        await api.post('/documentos', payload);
      }
      setModalOpen(false);
      fetchDocs();
      api.get('/demands/categories').then(res => setCategorias((res.data || []).map((c: { name: string }) => c.name).sort((a: string, b: string) => a.localeCompare(b, 'pt-BR')))).catch(() => {});
    } catch (err: any) { toast.error(`Erro ao salvar documento: ${err?.response?.data?.error || err?.message || 'Erro desconhecido'}`); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Excluir este documento?')) return;
    try {
      await api.delete(`/documentos/${id}`);
      fetchDocs();
    } catch { toast.error('Erro ao excluir'); }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

  const exportToPDF = async (mode: 'page' | 'all') => {
    setExporting(true);
    try {
      let dataToExport = docs;
      if (mode === 'all') {
        const params = new URLSearchParams({
          page: '1', limit: '1000',
          search,
          ...(filterTipo && { tipo: filterTipo }),
          ...(filterStatus && { status: filterStatus }),
          ...(filterOrigem && { origem: filterOrigem }),
        });
        const res = await api.get(`/documentos?${params}`);
        dataToExport = res.data.data || [];
      }

      const doc = new jsPDF();
      doc.setFillColor(30, 41, 59);
      doc.rect(0, 0, 210, 40, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('DOCUMENTOS DO GABINETE', 14, 20);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('CRM DO VERÊ - GESTÃO LEGISLATIVA', 14, 28);
      doc.text(`GERADO EM: ${new Date().toLocaleString('pt-BR')}`, 120, 28);

      const tableData = dataToExport.map(({ documento: d, municipe }) => [
        TIPO_LABELS[d.tipo] || d.tipo,
        d.categoria || '—',
        municipe ? firstName(municipe.name) : '—',
        d.numeroDocumento || '—',
        STATUS_LABELS[d.status] || d.status,
        formatDate(d.createdAt),
      ]);

      autoTable(doc, {
        startY: 45,
        head: [['TIPO', 'CATEGORIA', 'MUNÍCIPE', 'Nº PROTOCOLO', 'STATUS', 'DATA']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold', halign: 'left' },
        bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 1: { cellWidth: 60 } },
        didDrawPage: () => {
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(`Página ${doc.getNumberOfPages()}`, 14, doc.internal.pageSize.height - 10);
          doc.text('CRM do Verê - Sistema de Gestão', 150, doc.internal.pageSize.height - 10);
        },
      });

      doc.save(`documentos-${mode}-${new Date().getTime()}.pdf`);
      setExportModalOpen(false);
    } catch {
      toast.error('Erro ao exportar PDF');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-10">
      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight flex items-center gap-3">
            <File className="text-primary" size={32} />
            Documentos do Gabinete
          </h1>
          <div className="flex items-center gap-4 mt-1">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Ofícios, Requerimentos e mais</p>
            <Badge variant="outline" className="text-[10px] font-semibold uppercase rounded-full">
              {pagination.total} TOTAL
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setExportModalOpen(true)} title="Exportar PDF">
            <FileDown size={20} />
          </Button>
          <Button onClick={openCreate} className="flex items-center gap-2 font-semibold">
            <Plus size={18} /> Novo Documento
          </Button>
        </div>
      </header>

      {/* Filtros */}
      <Card>
        <CardContent className="p-3 flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full group">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              className="w-full pl-10 pr-4 py-2.5 bg-muted border border-transparent rounded-lg text-sm font-medium outline-none focus:bg-background focus:border-border transition-all text-foreground placeholder:text-muted-foreground"
              placeholder="Buscar por categoria ou munícipe..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
            />
          </div>
          <select className="px-3 py-2.5 bg-muted border border-transparent text-muted-foreground rounded-lg text-xs font-medium outline-none focus:border-border transition-all" value={filterTipo} onChange={e => { setFilterTipo(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}>
            <option value="">Todos os tipos</option>
            {Object.entries(TIPO_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select className="px-3 py-2.5 bg-muted border border-transparent text-muted-foreground rounded-lg text-xs font-medium outline-none focus:border-border transition-all" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}>
            <option value="">Todos os status</option>
            <option value="criado">Criado</option>
            <option value="enviado">Enviado</option>
            <option value="concluido">Concluído</option>
          </select>
          <select className="px-3 py-2.5 bg-muted border border-transparent text-muted-foreground rounded-lg text-xs font-medium outline-none focus:border-border transition-all" value={filterOrigem} onChange={e => { setFilterOrigem(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}>
            <option value="">Todas as origens</option>
            <option value="gabinete">Gabinete</option>
            <option value="municipe">Munícipe</option>
          </select>
          <select
            value={pagination.limit}
            onChange={e => setPagination(p => ({ ...p, page: 1, limit: Number(e.target.value) }))}
            className="px-3 py-2.5 bg-muted border border-transparent text-muted-foreground rounded-lg text-xs font-medium outline-none focus:border-border transition-all"
          >
            <option value={25}>25 / pág</option>
            <option value={50}>50 / pág</option>
            <option value={100}>100 / pág</option>
            <option value={9999}>Todos</option>
          </select>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card className="overflow-hidden relative">
        {loading && (
          <div className="absolute inset-0 bg-background/60 z-10 flex items-center justify-center">
            <Loader2 size={28} className="animate-spin text-primary" />
          </div>
        )}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="pl-5 cursor-pointer group w-[220px]" onClick={() => toggleSort('name')}>
                  <div className="flex items-center gap-1.5 group-hover:text-primary transition-colors">Munícipe <SortIcon field="name" /></div>
                </TableHead>
                <TableHead className="cursor-pointer group" onClick={() => toggleSort('categoria')}>
                  <div className="flex items-center gap-1.5 group-hover:text-primary transition-colors">Categoria / Descrição <SortIcon field="categoria" /></div>
                </TableHead>
                <TableHead>Nº / Link</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="cursor-pointer group" onClick={() => toggleSort('date')}>
                  <div className="flex items-center gap-1.5 group-hover:text-primary transition-colors">Data <SortIcon field="date" /></div>
                </TableHead>
                <TableHead className="text-right pr-5 w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && docs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-20 text-center text-muted-foreground text-xs uppercase tracking-widest font-semibold">
                    Nenhum documento encontrado
                  </TableCell>
                </TableRow>
              ) : sortedDocs.map(({ documento: d, municipe }) => (
                <TableRow key={d.id} className={cn('align-top', TIPO_ROW_BG[d.tipo])}>
                  <TableCell className="pl-5 w-[220px]">
                    <div className="flex flex-col">
                      <span className="font-semibold text-foreground">
                        {municipe ? municipe.name : d.origem === 'gabinete' ? <span className="text-muted-foreground">Gabinete</span> : <span className="text-muted-foreground/30 font-normal">—</span>}
                      </span>
                      {municipe && (
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1 mt-1">
                          <MapPin size={10} /> {municipe.bairro || 'Centro'}
                        </span>
                      )}
                      <div className="mt-2">
                        <Badge variant="outline" className={cn('text-[9px] font-semibold uppercase', TIPO_COLORS[d.tipo] || 'bg-muted text-muted-foreground')}>
                          {TIPO_LABELS[d.tipo] || d.tipo}
                        </Badge>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="w-[35%]">
                    <div className="font-semibold text-foreground text-sm break-words whitespace-normal">{d.categoria || '—'}</div>
                    {d.descricao && (
                      <div className="text-xs text-muted-foreground mt-1 leading-relaxed break-words whitespace-normal">{d.descricao}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      {d.numeroDocumento && <span className="text-xs font-semibold text-foreground">{d.numeroDocumento}</span>}
                      {d.documentUrl && /^https?:\/\//i.test(d.documentUrl) && (
                        <a href={d.documentUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                          <ExternalLink size={10} /> Ver doc
                        </a>
                      )}
                      {!d.numeroDocumento && !d.documentUrl && <span className="text-muted-foreground/40 text-xs">—</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn('text-[9px] font-semibold uppercase', STATUS_COLORS[d.status] || 'bg-muted text-muted-foreground')}>
                      {STATUS_LABELS[d.status] || d.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(d.createdAt)}</TableCell>
                  <TableCell className="pr-5">
                    <div className="flex justify-end items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => openEdit({ documento: d, municipe })}><Edit2 size={15} /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(d.id)}><Trash2 size={15} /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Paginação */}
        <div className="px-5 py-3 bg-muted/30 border-t border-border flex flex-col md:flex-row justify-between items-center gap-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
            {pagination.total} documento{pagination.total !== 1 ? 's' : ''} · pág. {pagination.page}/{pagination.totalPages || 1}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={pagination.page === 1 || loading} onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}>
              <ChevronLeft size={15} />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={pagination.page >= (pagination.totalPages || 1) || loading} onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}>
              <ChevronRight size={15} />
            </Button>
          </div>
        </div>
      </Card>

      {/* Export Modal */}
      {exportModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-border">
            <div className="px-6 py-5 border-b border-border flex justify-between items-center">
              <h3 className="text-lg font-semibold text-foreground">Exportar Documentos</h3>
              <button onClick={() => setExportModalOpen(false)} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-2">
              {[
                { mode: 'page' as const, icon: <FileDown size={18} />, label: 'Página Atual', sub: `${docs.length} desta página` },
                { mode: 'all' as const, icon: <Users size={18} />, label: 'Todos os Documentos', sub: `Todos os ${pagination.total} registros` },
              ].map(opt => (
                <button key={opt.mode} onClick={() => exportToPDF(opt.mode)} disabled={exporting}
                  className="w-full p-4 bg-muted border border-border rounded-xl text-left hover:border-primary hover:bg-primary/5 transition-all group flex items-center gap-3">
                  <div className="bg-background p-2 rounded-lg text-muted-foreground group-hover:text-primary shadow-xs transition-colors">{opt.icon}</div>
                  <div><p className="font-semibold text-foreground text-sm">{opt.label}</p><p className="text-xs text-muted-foreground mt-0.5">{opt.sub}</p></div>
                </button>
              ))}
              {exporting && (
                <div className="flex items-center justify-center gap-2 py-2 text-primary font-semibold text-sm">
                  <Loader2 size={16} className="animate-spin" /> Gerando PDF...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Criar/Editar */}
      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-border">
            <div className="px-8 py-5 border-b border-border flex justify-between items-center bg-muted/30">
              <h3 className="text-lg font-semibold text-foreground">{editing ? 'Editar Documento' : 'Novo Documento'}</h3>
              <button onClick={() => setModalOpen(false)} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground"><X size={18} /></button>
            </div>
            <div className="p-8 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="space-y-1">
                <label className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">Tipo *</label>
                <select className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
                  value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                  {Object.entries(TIPO_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">Categoria *</label>
                <select className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
                  value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                  <option value="">Selecione uma categoria...</option>
                  {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">Descrição</label>
                <textarea className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none text-foreground"
                  rows={3} placeholder="Detalhes adicionais (opcional)"
                  value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">Origem *</label>
                <div className="flex gap-4">
                  {[{ v: 'gabinete', l: 'Gabinete' }, { v: 'municipe', l: 'Munícipe' }].map(({ v, l }) => (
                    <label key={v} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="origem" value={v} checked={form.origem === v}
                        onChange={() => setForm(f => ({ ...f, origem: v, municipeId: '', municipeName: '' }))} />
                      <span className="text-sm font-medium text-foreground">{l}</span>
                    </label>
                  ))}
                </div>
              </div>
              {form.origem === 'municipe' && (
                <div className="space-y-1">
                  <label className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">Munícipe *</label>
                  <div className="relative">
                    <input className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
                      placeholder="Buscar por nome ou telefone..."
                      value={municipeSearch}
                      onChange={e => handleMunicipeSearch(e.target.value)} />
                    {searchingMunicipe && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-primary" />}
                    {municipeResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 bg-card border border-border rounded-xl shadow-lg z-10 mt-1 overflow-hidden">
                        {municipeResults.map(m => (
                          <button key={m.id} onClick={() => selectMunicipe(m)}
                            className="w-full px-4 py-2.5 text-left hover:bg-muted text-sm border-b border-border last:border-0">
                            <span className="font-semibold text-foreground">{m.name}</span>
                            {m.bairro && <span className="text-muted-foreground ml-2 text-xs">{m.bairro}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {form.municipeId && <p className="text-xs text-emerald-600 font-medium">✓ {form.municipeName} selecionado</p>}
                </div>
              )}
              <div className="space-y-1">
                <label className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">Nº Protocolo</label>
                <input className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
                  placeholder="Ex: 001/2026 (opcional)"
                  value={form.numeroDocumento} onChange={e => setForm(f => ({ ...f, numeroDocumento: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">Link do Documento</label>
                <input className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
                  placeholder="https://drive.google.com/... (opcional)"
                  value={form.documentUrl} onChange={e => setForm(f => ({ ...f, documentUrl: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">Status</label>
                <select className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
                  value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="criado">Criado</option>
                  <option value="enviado">Enviado</option>
                  <option value="concluido">Concluído</option>
                </select>
              </div>
            </div>
            <div className="px-8 py-4 border-t border-border flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {editing ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

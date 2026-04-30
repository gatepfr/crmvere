import { useState, useEffect, useCallback } from 'react';
import api from '../../api/client';
import { Plus, Search, Loader2, Edit2, Trash2, X, ExternalLink, File, FileDown, ChevronLeft, ChevronRight, Users, MapPin } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  encaminhamento_formal: 'Encaminh.',
  outro: 'Outro',
};

const TIPO_COLORS: Record<string, string> = {
  oficio: 'bg-blue-50 text-blue-600 border-blue-100',
  requerimento: 'bg-purple-50 text-purple-600 border-purple-100',
  projeto_lei: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  encaminhamento_formal: 'bg-amber-50 text-amber-600 border-amber-100',
  outro: 'bg-slate-50 text-slate-500 border-slate-100',
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
    if (!form.categoria.trim()) { alert('Categoria é obrigatória'); return; }
    if (form.origem === 'municipe' && !form.municipeId) { alert('Selecione um munícipe'); return; }
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
    } catch (err: any) { alert(`Erro ao salvar documento: ${err?.response?.data?.error || err?.message || 'Erro desconhecido'}`); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Excluir este documento?')) return;
    try {
      await api.delete(`/documentos/${id}`);
      fetchDocs();
    } catch { alert('Erro ao excluir'); }
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
      alert('Erro ao exportar PDF');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-10">
      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <File className="text-blue-600" size={32} />
            Documentos do Gabinete
          </h1>
          <div className="flex items-center gap-4 mt-1">
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Ofícios, Requerimentos e mais</p>
            <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black border border-blue-100 uppercase">
              {pagination.total} TOTAL
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setExportModalOpen(true)} className="p-2.5 bg-white border border-slate-200 text-slate-400 rounded-xl hover:text-blue-600 hover:bg-blue-50 transition-all shadow-sm" title="Exportar PDF">
            <FileDown size={24} />
          </button>
          <button onClick={openCreate} className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-sm flex items-center gap-2 shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all">
            <Plus size={20} /> NOVO DOCUMENTO
          </button>
        </div>
      </header>

      {/* Filtros */}
      <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100 flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-transparent rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-blue-200 transition-all"
            placeholder="Buscar por categoria ou munícipe..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
          />
        </div>
        <select className="px-3 py-2.5 bg-slate-50 border border-transparent text-slate-600 rounded-xl text-xs font-bold outline-none" value={filterTipo} onChange={e => { setFilterTipo(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}>
          <option value="">Todos os tipos</option>
          {Object.entries(TIPO_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className="px-3 py-2.5 bg-slate-50 border border-transparent text-slate-600 rounded-xl text-xs font-bold outline-none" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}>
          <option value="">Todos os status</option>
          <option value="criado">Criado</option>
          <option value="enviado">Enviado</option>
          <option value="concluido">Concluído</option>
        </select>
        <select className="px-3 py-2.5 bg-slate-50 border border-transparent text-slate-600 rounded-xl text-xs font-bold outline-none" value={filterOrigem} onChange={e => { setFilterOrigem(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}>
          <option value="">Todas as origens</option>
          <option value="gabinete">Gabinete</option>
          <option value="municipe">Munícipe</option>
        </select>
        <select
          value={pagination.limit}
          onChange={e => setPagination(p => ({ ...p, page: 1, limit: Number(e.target.value) }))}
          className="px-3 py-2.5 bg-slate-50 border border-transparent text-slate-600 rounded-xl text-xs font-bold outline-none"
        >
          <option value={25}>25 / pág</option>
          <option value={50}>50 / pág</option>
          <option value={100}>100 / pág</option>
          <option value={9999}>Todos</option>
        </select>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden relative min-h-[300px]">
        {loading && (
          <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center">
            <Loader2 size={32} className="animate-spin text-blue-600" />
          </div>
        )}
        {!loading && docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <File size={40} className="mb-3 opacity-30" />
            <p className="font-black text-sm uppercase tracking-widest">Nenhum documento encontrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="px-6 py-4 w-1/5">Munícipe</th>
                  <th className="px-6 py-4 w-2/5">Categoria / Descrição</th>
                  <th className="px-6 py-4">Nº / Link</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Data</th>
                  <th className="px-6 py-4 text-right w-24">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {docs.map(({ documento: d, municipe }) => (
                  <tr key={d.id} className="group hover:bg-slate-50/30 transition-all align-top">
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {municipe ? municipe.name : <span className="text-slate-300 font-normal">—</span>}
                        </span>
                        {municipe && (
                          <span className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1 mt-1">
                            <MapPin size={10} /> {municipe.bairro || 'Centro'}
                          </span>
                        )}
                        <div className="mt-2">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase ${TIPO_COLORS[d.tipo] || 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                            {TIPO_LABELS[d.tipo] || d.tipo}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="font-semibold text-slate-800 text-sm">{d.categoria || '—'}</div>
                      {d.descricao && (
                        <div className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">{d.descricao}</div>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-0.5">
                        {d.numeroDocumento && <span className="text-xs font-bold text-slate-700">{d.numeroDocumento}</span>}
                        {d.documentUrl && /^https?:\/\//i.test(d.documentUrl) && (
                          <a href={d.documentUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                            <ExternalLink size={10} /> Ver doc
                          </a>
                        )}
                        {!d.numeroDocumento && !d.documentUrl && <span className="text-slate-300 text-xs">—</span>}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`text-[9px] font-black px-2 py-1 rounded border uppercase ${STATUS_COLORS[d.status] || 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                        {STATUS_LABELS[d.status] || d.status}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-xs text-slate-400 whitespace-nowrap">{formatDate(d.createdAt)}</td>
                    <td className="px-6 py-5">
                      <div className="flex justify-end items-center gap-1">
                        <button onClick={() => openEdit({ documento: d, municipe })} className="p-2 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-xl transition-all"><Edit2 size={16} /></button>
                        <button onClick={() => handleDelete(d.id)} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-xl transition-all"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginação */}
        {!loading && (
          <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {pagination.total} DOCUMENTO{pagination.total !== 1 ? 'S' : ''} • PÁGINA {pagination.page} DE {pagination.totalPages || 1}
            </p>
            {pagination.totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button disabled={pagination.page === 1} onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                  className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 disabled:opacity-30 hover:bg-slate-50 shadow-sm">
                  <ChevronLeft size={16} />
                </button>
                <button disabled={pagination.page === pagination.totalPages} onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                  className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 disabled:opacity-30 hover:bg-slate-50 shadow-sm">
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Export Modal */}
      {exportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-black text-slate-900">Exportar Documentos</h3>
              <button onClick={() => setExportModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={18} className="text-slate-500" /></button>
            </div>
            <div className="p-6 space-y-3">
              <button onClick={() => exportToPDF('page')} disabled={exporting}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-left hover:border-blue-500 hover:bg-blue-50 transition-all group">
                <div className="flex items-center gap-3">
                  <div className="bg-white p-2 rounded-xl text-slate-400 group-hover:text-blue-600 shadow-sm transition-colors"><FileDown size={20} /></div>
                  <div>
                    <p className="font-bold text-slate-900">Página Atual</p>
                    <p className="text-xs text-slate-500">Exportar registros visíveis na tela</p>
                  </div>
                </div>
              </button>
              <button onClick={() => exportToPDF('all')} disabled={exporting}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-left hover:border-blue-500 hover:bg-blue-50 transition-all group">
                <div className="flex items-center gap-3">
                  <div className="bg-white p-2 rounded-xl text-slate-400 group-hover:text-blue-600 shadow-sm transition-colors"><Users size={20} /></div>
                  <div>
                    <p className="font-bold text-slate-900">Todos os Documentos</p>
                    <p className="text-xs text-slate-500">Exportar todos os {pagination.total} documentos</p>
                  </div>
                </div>
              </button>
              {exporting && (
                <div className="flex items-center justify-center gap-2 py-2 text-blue-600 font-bold text-sm">
                  <Loader2 size={16} className="animate-spin" /> Gerando PDF...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Criar/Editar */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-lg font-black text-slate-900">{editing ? 'Editar Documento' : 'Novo Documento'}</h3>
              <button onClick={() => setModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={18} className="text-slate-500" /></button>
            </div>
            <div className="p-8 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tipo *</label>
                <select className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                  {Object.entries(TIPO_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Categoria *</label>
                <select
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.categoria}
                  onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                >
                  <option value="">Selecione uma categoria...</option>
                  {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Descrição</label>
                <textarea className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={3} placeholder="Detalhes adicionais (opcional)"
                  value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Origem *</label>
                <div className="flex gap-4">
                  {[{ v: 'gabinete', l: 'Gabinete' }, { v: 'municipe', l: 'Munícipe' }].map(({ v, l }) => (
                    <label key={v} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="origem" value={v} checked={form.origem === v}
                        onChange={() => setForm(f => ({ ...f, origem: v, municipeId: '', municipeName: '' }))} />
                      <span className="text-sm font-medium text-slate-700">{l}</span>
                    </label>
                  ))}
                </div>
              </div>
              {form.origem === 'municipe' && (
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Munícipe *</label>
                  <div className="relative">
                    <input className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Buscar por nome ou telefone..."
                      value={municipeSearch}
                      onChange={e => handleMunicipeSearch(e.target.value)} />
                    {searchingMunicipe && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-blue-400" />}
                    {municipeResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg z-10 mt-1 overflow-hidden">
                        {municipeResults.map(m => (
                          <button key={m.id} onClick={() => selectMunicipe(m)}
                            className="w-full px-4 py-2.5 text-left hover:bg-slate-50 text-sm border-b border-slate-50 last:border-0">
                            <span className="font-semibold text-slate-800">{m.name}</span>
                            {m.bairro && <span className="text-slate-400 ml-2 text-xs">{m.bairro}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {form.municipeId && <p className="text-xs text-green-600 font-medium">✓ {form.municipeName} selecionado</p>}
                </div>
              )}
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Nº Protocolo</label>
                <input className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: 001/2026 (opcional)"
                  value={form.numeroDocumento} onChange={e => setForm(f => ({ ...f, numeroDocumento: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Link do Documento</label>
                <input className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://drive.google.com/... (opcional)"
                  value={form.documentUrl} onChange={e => setForm(f => ({ ...f, documentUrl: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</label>
                <select className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="criado">Criado</option>
                  <option value="enviado">Enviado</option>
                  <option value="concluido">Concluído</option>
                </select>
              </div>
            </div>
            <div className="px-8 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setModalOpen(false)} className="px-5 py-2.5 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {editing ? 'Salvar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

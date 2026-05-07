import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import api from '../../api/client';
import NewDemandModal from '../../components/NewDemandModal';
import LegislativoEditModal from '../../components/LegislativoEditModal';
import {
  ClipboardList,
  Search,
  Loader2,
  MapPin,
  Plus,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  FileText,
  Edit2,
  Trash2,
  Send,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileDown,
  Users,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Demand {
  id: string;
  descricao: string;
  categoria: string;
  status: string;
  isLegislativo: boolean;
  numeroIndicacao: string | null;
  documentUrl: string | null;
  assignedToId: string | null;
  dueDate: string | null;
  createdAt: string;
  municipes: {
    id: string;
    name: string;
    phone: string;
    bairro: string | null;
  };
}

interface TeamMember {
  id: string;
  email: string;
  role: string;
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

type SortField = 'name' | 'subject' | 'number' | 'date';
type SortOrder = 'asc' | 'desc';

type FilterMode = 'all' | 'mine' | 'unassigned' | 'overdue';

export default function Legislativo() {
  const [demands, setDemands] = useState<Demand[]>([]);
  const [loading, setLoading] = useState(true);
  const [cabinetConfig, setCabinetConfig] = useState<CabinetConfig | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [onlyPending, setOnlyPending] = useState(false);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedDemand, setSelectedDemand] = useState<{ demandas: Demand; municipes: Demand['municipes'] } | null>(null);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });

  // PDF Export States
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const loadDemands = useCallback(async () => {
    setLoading(true);
    try {
      if (!cabinetConfig) {
        const [configRes, teamRes] = await Promise.all([api.get('/config/me'), api.get('/team')]);
        setCabinetConfig(configRes.data);
        setTeamMembers(teamRes.data || []);
      }

      if (filterMode === 'mine') {
        const res = await api.get('/demands/my');
        setDemands((res.data as any[]).map((d: any) => ({
          ...d.demandas,
          municipes: d.municipes,
          assignedToEmail: null,
        })));
        setPagination({ page: 1, limit: 1000, total: res.data.length, totalPages: 1 });
      } else {
        const params = new URLSearchParams({
          page: pagination.page.toString(),
          limit: pagination.limit.toString(),
          search: searchTerm,
        });
        if (filterMode === 'unassigned') params.set('unassigned', 'true');
        if (filterMode === 'overdue') params.set('overdue', 'true');

        const res = await api.get(`/demands?${params.toString()}`);
        setDemands(res.data.data.map((d: any) => ({
          ...d.demandas,
          municipes: d.municipes,
          assignedToEmail: d.assignedTo?.email || null,
        })));
        setPagination(res.data.pagination);
      }
    } catch (err) {
      console.error('Erro ao carregar dados legislativos');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, searchTerm, filterMode, cabinetConfig]);

  useEffect(() => {
    loadDemands();
  }, [loadDemands]);

  const toggleLegislativo = async (id: string, current: boolean) => {
    try {
      const num = current ? null : prompt('Digite o número da Indicação (ex: 123/2026):');
      if (current === false && num === null) return;

      await api.patch(`/demands/${id}/status`, { 
        isLegislativo: !current,
        numeroIndicacao: num 
      });
      loadDemands();
    } catch (err) {
      toast.error('Erro ao atualizar status legislativo');
    }
  };

  const updateDocUrl = async (d: Demand) => {
    const url = prompt('Cole o link do PDF ou da Indicação no site da Câmara:', d.documentUrl || '');
    if (url === null) return;
    try {
      await api.patch(`/demands/${d.id}/status`, { documentUrl: url });
      loadDemands();
    } catch (err) {
      toast.error('Erro ao atualizar link');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta indicação? Esta ação não pode ser desfeita.')) return;
    try {
      await api.delete(`/demands/${id}`);
      setDemands(prev => prev.filter(d => d.id !== id));
      toast.success('Excluído com sucesso!');
    } catch (err) {
      toast.error('Erro ao excluir.');
    }
  };


  const sendToWhatsApp = async (d: Demand) => {
    if (!d.documentUrl) {
      toast.warning('Adicione o link da indicação primeiro!');
      return;
    }
    const defaultMsg = `Olá ${d.municipes.name}! Gostaria de informar que sua solicitação sobre *${d.categoria.toUpperCase()}* virou a Indicação oficial nº *${d.numeroIndicacao}*. Você pode acompanhar por aqui: ${d.documentUrl}`;
    
    let msg = cabinetConfig?.legislativeMessage || defaultMsg;
    msg = msg.replace(/{nome}/g, d.municipes.name)
             .replace(/{assunto}/g, d.categoria.toUpperCase())
             .replace(/{numero}/g, d.numeroIndicacao || '')
             .replace(/{link}/g, d.documentUrl);

    try {
      await api.post('/whatsapp/send-direct', {
        phone: d.municipes.phone,
        message: msg
      });
      toast.success('Link enviado com sucesso!');
    } catch (err) {
      toast.error('Erro ao enviar WhatsApp.');
    }
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedDemands = useMemo(() => {
    const filtered = demands.filter(d => {
      if (onlyPending) return !d.isLegislativo;
      return true;
    });

    return [...filtered].sort((a, b) => {
      let valA: any, valB: any;
      
      switch (sortField) {
        case 'name':
          valA = a.municipes.name.toLowerCase();
          valB = b.municipes.name.toLowerCase();
          break;
        case 'subject':
          valA = a.descricao.toLowerCase();
          valB = b.descricao.toLowerCase();
          break;
        case 'number':
          valA = a.numeroIndicacao || '';
          valB = b.numeroIndicacao || '';
          break;
        case 'date':
        default:
          valA = new Date(a.createdAt).getTime();
          valB = new Date(b.createdAt).getTime();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [demands, onlyPending, sortField, sortOrder]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={12} className="text-slate-300 group-hover:text-slate-400" />;
    return sortOrder === 'asc' ? <ArrowUp size={12} className="text-blue-600" /> : <ArrowDown size={12} className="text-blue-600" />;
  };

  const exportToPDF = async (mode: 'page' | 'all') => {
    setExporting(true);
    try {
      let dataToExport = sortedDemands;

      if (mode === 'all') {
        const res = await api.get(`/demands?limit=1000&search=${searchTerm}`);
        dataToExport = res.data.data.map((d: any) => ({
          ...d.demandas,
          municipes: d.municipes
        }));
      }

      const doc = new jsPDF();
      
      doc.setFillColor(30, 41, 59);
      doc.rect(0, 0, 210, 40, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('RELATÓRIO DE INDICAÇÕES', 14, 20);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('CRM DO VERÊ - GESTÃO LEGISLATIVA', 14, 28);
      doc.text(`GERADO EM: ${new Date().toLocaleString('pt-BR')}`, 140, 28);

      const tableData = dataToExport.map(d => [
        d.municipes.name,
        d.municipes.bairro || '---',
        d.descricao,
        d.isLegislativo ? `IND ${d.numeroIndicacao || 'S/N'}` : 'PENDENTE',
        new Date(d.createdAt).toLocaleDateString('pt-BR')
      ]);

      autoTable(doc, {
        startY: 45,
        head: [['MUNÍCIPE', 'BAIRRO', 'ASSUNTO / SOLICITAÇÃO', 'STATUS', 'DATA']],
        body: tableData,
        theme: 'striped',
        headStyles: { 
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: 'bold',
          halign: 'left'
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [51, 65, 85]
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        columnStyles: {
          2: { cellWidth: 80 } // Assunto mais largo
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

      doc.save(`indicacoes-${mode}-${new Date().getTime()}.pdf`);
      setIsExportModalOpen(false);
    } catch (err) {
      toast.error('Erro ao exportar PDF');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-10">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight flex items-center gap-3">
            <ClipboardList className="text-primary" size={32} />
            Indicações Legislativas
          </h1>
          <div className="flex items-center gap-4 mt-1">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Transformando demandas em proposituras</p>
            <Badge variant="outline" className="text-[10px] font-semibold uppercase rounded-full">
              {pagination.total} TOTAL
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setIsExportModalOpen(true)} title="Exportar PDF">
            <FileDown size={20} />
          </Button>
          <Button onClick={() => setIsNewModalOpen(true)} className="flex items-center gap-2 font-semibold">
            <Plus size={18} /> Nova Indicação
          </Button>
        </div>
      </header>

      <Card>
        <CardContent className="p-3 flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={15} />
            <input
              type="text"
              placeholder="Buscar por nome, bairro ou assunto..."
              className="w-full pl-10 pr-4 py-2.5 bg-muted border border-transparent rounded-lg outline-none focus:bg-background focus:border-border transition-all text-sm font-medium text-foreground placeholder:text-muted-foreground"
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
            />
          </div>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1 border border-border/50">
            {(['all', 'mine', 'unassigned', 'overdue'] as FilterMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => { setFilterMode(mode); setPagination(p => ({ ...p, page: 1 })); }}
                className={cn(
                  'px-3 py-1.5 rounded-md font-semibold text-[10px] uppercase tracking-widest transition-all',
                  filterMode === mode ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  mode === 'overdue' && filterMode === mode && 'text-destructive'
                )}
              >
                {mode === 'all' ? 'Todas' : mode === 'mine' ? 'Minhas' : mode === 'unassigned' ? 'Sem resp.' : 'Vencidas'}
              </button>
            ))}
          </div>
          <button
            onClick={() => setOnlyPending(!onlyPending)}
            className={cn(
              'px-4 py-2.5 rounded-lg font-semibold text-[10px] uppercase tracking-widest transition-all border flex items-center gap-2',
              onlyPending ? 'bg-amber-500 border-amber-400 text-white shadow-sm' : 'bg-muted border-transparent text-muted-foreground hover:bg-muted/80'
            )}
          >
            <AlertCircle size={14} /> Pendentes
          </button>
          <select
            className="px-3 py-2.5 bg-muted border border-transparent text-muted-foreground rounded-lg outline-none text-xs font-medium focus:border-border transition-all"
            value={pagination.limit === 10000 ? 'all' : pagination.limit}
            onChange={e => setPagination(prev => ({ ...prev, limit: e.target.value === 'all' ? 10000 : parseInt(e.target.value), page: 1 }))}
          >
            <option value="25">25 / pág</option>
            <option value="50">50 / pág</option>
            <option value="all">Ver Todos</option>
          </select>
        </CardContent>
      </Card>

      <Card className="overflow-hidden relative">
        {loading && <div className="absolute inset-0 bg-background/60 z-10 flex items-center justify-center"><Loader2 className="animate-spin text-primary" size={28} /></div>}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="pl-5 cursor-pointer group" onClick={() => toggleSort('name')}>
                  <div className="flex items-center gap-1.5 group-hover:text-primary transition-colors">Munícipe <SortIcon field="name" /></div>
                </TableHead>
                <TableHead className="cursor-pointer group" onClick={() => toggleSort('subject')}>
                  <div className="flex items-center gap-1.5 group-hover:text-primary transition-colors">Assunto Detalhado <SortIcon field="subject" /></div>
                </TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead className="text-center cursor-pointer group" onClick={() => toggleSort('number')}>
                  <div className="flex items-center justify-center gap-1.5 group-hover:text-primary transition-colors">Nº Indicação <SortIcon field="number" /></div>
                </TableHead>
                <TableHead className="text-center w-32">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedDemands.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-20 text-center text-muted-foreground text-xs uppercase tracking-widest font-semibold">
                    Nenhuma indicação encontrada
                  </TableCell>
                </TableRow>
              ) : sortedDemands.map(d => {
                const isOverdue = d.dueDate && new Date(d.dueDate) < new Date() && d.status !== 'concluida';
                const assignedEmail = (d as any).assignedToEmail as string | null;
                return (
                  <TableRow key={d.id} className={cn('align-top', isOverdue && 'bg-destructive/5')}>
                    <TableCell className="pl-5">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{d.municipes.name}</span>
                          {isOverdue && <Badge className="bg-destructive text-destructive-foreground text-[8px] px-1.5 py-0">Vencida</Badge>}
                        </div>
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1 mt-1">
                          <MapPin size={10} /> {d.municipes.bairro || 'Centro'}
                        </span>
                        <div className="mt-2">
                          <Badge variant="outline" className="text-[9px] font-semibold uppercase bg-primary/10 text-primary border-primary/20">
                            {d.categoria}
                          </Badge>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="w-[40%]">
                      <div className="text-sm text-foreground leading-relaxed break-words whitespace-normal font-medium">
                        {d.descricao}
                      </div>
                      {d.documentUrl && (
                        <a href={d.documentUrl} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1.5 mt-3 text-primary font-semibold text-[10px] uppercase hover:underline">
                          <FileText size={12} /> Ver documento oficial
                        </a>
                      )}
                      {d.dueDate && (
                        <div className={cn('mt-2 text-[10px] font-semibold uppercase', isOverdue ? 'text-destructive' : 'text-muted-foreground')}>
                          Prazo: {new Date(d.dueDate).toLocaleDateString('pt-BR')}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {assignedEmail ? (
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs">
                            {assignedEmail[0].toUpperCase()}
                          </div>
                          <span className="text-xs font-medium text-foreground truncate max-w-[100px]">{assignedEmail.split('@')[0]}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/40 font-semibold uppercase">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-2">
                        <button
                          onClick={() => toggleLegislativo(d.id, d.isLegislativo)}
                          className={cn(
                            'w-full py-1.5 px-3 rounded-lg text-[10px] font-semibold uppercase border transition-all',
                            d.isLegislativo
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                              : 'bg-muted border-border text-muted-foreground hover:border-primary hover:text-primary'
                          )}
                        >
                          {d.isLegislativo ? `Indicação ${d.numeroIndicacao || 'S/N'}` : 'Não protocolada'}
                        </button>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => updateDocUrl(d)}
                            className={cn(
                              'flex items-center gap-1.5 font-semibold text-[10px] uppercase transition-colors',
                              d.documentUrl ? 'text-emerald-600 hover:text-emerald-700' : 'text-muted-foreground hover:text-primary'
                            )}
                            title="Anexar Link PDF"
                          >
                            <FileText size={12} /> {d.documentUrl ? 'Editar Link' : 'Link PDF'}
                          </button>
                          {d.isLegislativo && (
                            <button
                              onClick={() => sendToWhatsApp(d)}
                              className="flex items-center gap-1.5 text-primary hover:text-primary/70 font-semibold text-[10px] uppercase transition-colors"
                            >
                              <Send size={12} /> Avisar
                            </button>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={() => setSelectedDemand({ demandas: d, municipes: d.municipes })} title="Editar Detalhes">
                          <Edit2 size={16} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(d.id)} title="Excluir Indicação">
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="px-5 py-3 bg-muted/30 border-t border-border flex flex-col md:flex-row justify-between items-center gap-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
            {pagination.total} demandas · pág. {pagination.page}/{pagination.totalPages}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={pagination.page === 1 || loading} onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}>
              <ChevronLeft size={15} />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={pagination.page === pagination.totalPages || loading} onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}>
              <ChevronRight size={15} />
            </Button>
          </div>
        </div>
      </Card>

      {isNewModalOpen && (
        <NewDemandModal 
          onClose={() => setIsNewModalOpen(false)} 
          onUpdate={loadDemands} 
        />
      )}

      {selectedDemand && (
        <LegislativoEditModal 
          demand={selectedDemand} 
          onClose={() => setSelectedDemand(null)} 
          onUpdate={loadDemands} 
        />
      )}

      {/* Export Modal */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-border">
            <div className="px-6 py-5 border-b border-border flex justify-between items-center">
              <h3 className="text-lg font-semibold text-foreground">Exportar Indicações</h3>
              <button onClick={() => setIsExportModalOpen(false)} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-2">
              {[
                { mode: 'page' as const, icon: <FileDown size={18} />, label: 'Página Atual', sub: 'Exportar registros visíveis na tela' },
                { mode: 'all' as const, icon: <Users size={18} />, label: 'Todas Indicações', sub: 'Exportar todo o histórico (máx 1000)' },
              ].map(opt => (
                <button key={opt.mode} onClick={() => exportToPDF(opt.mode)} disabled={exporting}
                  className="w-full p-4 bg-muted border border-border rounded-xl text-left hover:border-primary hover:bg-primary/5 transition-all group flex items-center gap-3">
                  <div className="bg-background p-2 rounded-lg text-muted-foreground group-hover:text-primary shadow-xs transition-colors">{opt.icon}</div>
                  <div><p className="font-semibold text-foreground text-sm">{opt.label}</p><p className="text-xs text-muted-foreground mt-0.5">{opt.sub}</p></div>
                </button>
              ))}
              {exporting && (
                <div className="flex items-center justify-center gap-2 py-2 text-primary font-semibold text-sm">
                  <Loader2 className="animate-spin" size={16} /> Gerando PDF...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState, useCallback } from 'react';
import api from '../../api/client';
import DemandModal from '../../components/DemandModal';
import NewDemandModal from '../../components/NewDemandModal';
import {
  FileDown, Loader2, MessageSquare, ArrowUpDown, ArrowUp, ArrowDown,
  Plus, AlertCircle, Search, ChevronLeft, ChevronRight, Users, X
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatPhone } from '../../utils/formatPhone';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface Atendimento {
  atendimentos: {
    id: string; resumoIa: string; categoria?: string | null;
    prioridade?: string | null; precisaRetorno: boolean;
    createdAt: string; updatedAt: string;
  };
  municipes: { id: string; name: string; phone: string; demandCount: number; bairro: string | null; };
}

interface Pagination { page: number; limit: number; total: number; totalPages: number; }

const formatName = (name: string) =>
  name ? name.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '';

type Priority = 'urgente' | 'alta' | 'media' | 'baixa';

const priorityConfig: Record<Priority, { label: string; className: string }> = {
  urgente: { label: 'Urgente', className: 'bg-red-100 text-red-700 border-red-200' },
  alta:    { label: 'Alta',    className: 'bg-orange-100 text-orange-700 border-orange-200' },
  media:   { label: 'Média',   className: 'bg-amber-100 text-amber-700 border-amber-200' },
  baixa:   { label: 'Baixa',   className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

function PriorityBadge({ priority }: { priority: string | null | undefined }) {
  const cfg = priorityConfig[(priority as Priority) ?? 'baixa'] ?? priorityConfig.baixa;
  return (
    <Badge variant="outline" className={cn('text-[10px] font-semibold uppercase', cfg.className)}>
      {cfg.label}
    </Badge>
  );
}

export default function Demands() {
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAtendimento, setSelectedAtendimento] = useState<Atendimento | null>(null);
  const [isNewDemandModalOpen, setIsNewDemandModalOpen] = useState(false);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterByAttention, setFilterByAttention] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'updatedAt', direction: 'desc' });
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchAtendimentos = useCallback((isBackground = false) => {
    if (!isBackground) setLoading(true);
    const params = new URLSearchParams({
      page: pagination.page.toString(), limit: pagination.limit.toString(),
      search: searchTerm, attention: filterByAttention.toString(),
      sortBy: sortConfig.key, sortOrder: sortConfig.direction,
    });
    api.get(`/demands/atendimentos?${params.toString()}`)
      .then(res => {
        setAtendimentos(res.data.data || []);
        setPagination(res.data.pagination || { page: 1, limit: 25, total: 0, totalPages: 0 });
      })
      .catch(err => console.error(err))
      .finally(() => { if (!isBackground) setLoading(false); });
  }, [pagination.page, pagination.limit, searchTerm, filterByAttention, sortConfig]);

  useEffect(() => {
    fetchAtendimentos();
    const interval = setInterval(() => { if (!document.hidden) fetchAtendimentos(true); }, 15000);
    return () => clearInterval(interval);
  }, [fetchAtendimentos]);

  const handleSort = (key: string) => {
    setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const SortIcon = ({ col }: { col: string }) =>
    sortConfig.key === col
      ? sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
      : <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-60" />;

  const exportToPDF = async (mode: 'page' | 'all') => {
    setExporting(true);
    try {
      let data = atendimentos;
      if (mode === 'all') {
        const res = await api.get(`/demands/atendimentos?limit=1000&sortBy=${sortConfig.key}&sortOrder=${sortConfig.direction}`);
        data = res.data.data;
      }
      const doc = new jsPDF();
      doc.setFillColor(30, 41, 59); doc.rect(0, 0, 210, 40, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(22); doc.setFont('helvetica', 'bold');
      doc.text('RELATÓRIO DE ATENDIMENTOS', 14, 20); doc.setFontSize(10);
      doc.text('CRM DO VERÊ - GESTÃO DE GABINETE', 14, 28);
      doc.text(`GERADO EM: ${new Date().toLocaleString('pt-BR')}`, 140, 28);
      autoTable(doc, {
        startY: 45, head: [['NOME', 'WHATSAPP', 'CATEGORIA', 'PRIORIDADE', 'DATA']],
        body: data.map(a => [
          a.municipes.name, formatPhone(a.municipes.phone),
          a.atendimentos.categoria || 'OUTRO', a.atendimentos.prioridade || 'baixa',
          new Date(a.atendimentos.updatedAt).toLocaleDateString('pt-BR'),
        ]),
        theme: 'striped', headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
      });
      doc.save(`atendimentos-${Date.now()}.pdf`); setIsExportModalOpen(false);
    } catch { alert('Erro ao exportar PDF'); }
    finally { setExporting(false); }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-500">

      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
            <MessageSquare className="text-primary" size={28} /> Atendimento
          </h1>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mt-1">Histórico WhatsApp e IA</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setIsNewDemandModalOpen(true)} className="gap-2">
            <Plus size={16} /> Adicionar
          </Button>
          <Button variant="outline" size="icon" onClick={() => setIsExportModalOpen(true)} title="Exportar PDF">
            <FileDown size={18} />
          </Button>
        </div>
      </header>

      {/* Filter bar */}
      <Card>
        <CardContent className="p-3 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1 group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={15} />
            <input
              type="text"
              placeholder="Buscar por munícipe ou telefone..."
              className="w-full pl-10 pr-4 py-2.5 bg-muted border border-transparent rounded-lg outline-none focus:bg-background focus:border-border transition-all text-sm font-medium text-foreground placeholder:text-muted-foreground"
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterByAttention(!filterByAttention)}
              className={cn(
                'px-5 py-2.5 rounded-lg text-[10px] font-semibold uppercase tracking-widest transition-all border flex items-center gap-1.5',
                filterByAttention
                  ? 'bg-destructive border-destructive/80 text-destructive-foreground shadow-sm'
                  : 'bg-muted border-transparent text-muted-foreground hover:bg-muted/80'
              )}
            >
              <AlertCircle size={13} /> Atenção
            </button>
            <select
              className="px-3 py-2.5 bg-muted border border-transparent text-muted-foreground rounded-lg outline-none text-xs font-medium focus:border-border transition-all"
              value={pagination.limit}
              onChange={e => setPagination(prev => ({ ...prev, limit: parseInt(e.target.value), page: 1 }))}
            >
              <option value="25">25 / pág</option>
              <option value="50">50 / pág</option>
              <option value="100">100 / pág</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden relative">
        {loading && (
          <div className="absolute inset-0 bg-background/60 z-10 flex items-center justify-center">
            <Loader2 className="animate-spin text-primary" size={28} />
          </div>
        )}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="pl-5 cursor-pointer group" onClick={() => handleSort('municipes.name')}>
                  <div className="flex items-center gap-1.5">Munícipe <SortIcon col="municipes.name" /></div>
                </TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead className="cursor-pointer group" onClick={() => handleSort('atendimentos.categoria')}>
                  <div className="flex items-center gap-1.5">Categoria <SortIcon col="atendimentos.categoria" /></div>
                </TableHead>
                <TableHead className="cursor-pointer group" onClick={() => handleSort('atendimentos.prioridade')}>
                  <div className="flex items-center gap-1.5">Prioridade <SortIcon col="atendimentos.prioridade" /></div>
                </TableHead>
                <TableHead className="text-right pr-5 cursor-pointer group" onClick={() => handleSort('atendimentos.updatedAt')}>
                  <div className="flex items-center justify-end gap-1.5">Data <SortIcon col="atendimentos.updatedAt" /></div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {atendimentos.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-20 text-center text-muted-foreground text-xs uppercase tracking-widest font-semibold">
                    Nenhum atendimento encontrado
                  </TableCell>
                </TableRow>
              ) : atendimentos.map(a => (
                <TableRow
                  key={a.atendimentos.id}
                  className={cn('cursor-pointer', a.atendimentos.precisaRetorno && 'bg-destructive/5')}
                  onClick={() => setSelectedAtendimento(a)}
                >
                  <TableCell className="pl-5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{formatName(a.municipes.name)}</span>
                      {a.atendimentos.precisaRetorno && (
                        <Badge className="bg-destructive text-destructive-foreground text-[9px] px-1.5 py-0">
                          EQUIPE
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-medium text-muted-foreground">{formatPhone(a.municipes.phone)}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {a.atendimentos.categoria?.replace('_', ' ') || 'OUTRO'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <PriorityBadge priority={a.atendimentos.prioridade} />
                  </TableCell>
                  <TableCell className="text-right pr-5 text-xs font-medium text-muted-foreground">
                    {new Date(a.atendimentos.updatedAt).toLocaleDateString('pt-BR')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="px-5 py-3 bg-muted/30 border-t border-border flex flex-col md:flex-row justify-between items-center gap-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
            {pagination.total} atendimentos · pág. {pagination.page}/{pagination.totalPages}
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

      {/* Export modal */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-border">
            <div className="px-6 py-5 border-b border-border flex justify-between items-center">
              <h3 className="text-lg font-semibold text-foreground">Exportar Atendimentos</h3>
              <button onClick={() => setIsExportModalOpen(false)} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-2">
              {[
                { mode: 'page' as const, icon: <FileDown size={18} />, label: 'Página Atual', sub: `${atendimentos.length} desta página` },
                { mode: 'all' as const, icon: <Users size={18} />, label: 'Histórico Completo', sub: `Todos os ${pagination.total} registros` },
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

      {selectedAtendimento && (
        <DemandModal
          demand={{
            demandas: {
              id: selectedAtendimento.atendimentos.id,
              resumoIa: selectedAtendimento.atendimentos.resumoIa,
              precisaRetorno: selectedAtendimento.atendimentos.precisaRetorno,
              createdAt: selectedAtendimento.atendimentos.createdAt,
              status: selectedAtendimento.atendimentos.precisaRetorno ? 'nova' : 'concluida',
              categoria: selectedAtendimento.atendimentos.categoria || 'OUTRO',
              prioridade: selectedAtendimento.atendimentos.prioridade || 'media',
            },
            atendimentoId: selectedAtendimento.atendimentos.id,
            municipes: selectedAtendimento.municipes,
          }}
          onClose={() => setSelectedAtendimento(null)}
          onUpdate={fetchAtendimentos}
        />
      )}

      {isNewDemandModalOpen && (
        <NewDemandModal onClose={() => setIsNewDemandModalOpen(false)} onUpdate={fetchAtendimentos} />
      )}
    </div>
  );
}

import { useEffect, useState, useMemo, useCallback } from 'react';
import api from '../../api/client';
import DemandModal from '../../components/DemandModal';
import NewDemandModal from '../../components/NewDemandModal';
import { 
  FileDown, 
  Loader2, 
  ClipboardList, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Plus, 
  AlertCircle, 
  Search, 
  Tag, 
  Clock,
  ChevronLeft,
  ChevronRight,
  Phone,
  Filter,
  MessageSquare,
  Edit2,
  Trash2,
  X,
  Users
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatPhone } from '../../utils/formatPhone';

interface Atendimento {
  atendimentos: {
    id: string;
    resumoIa: string;
    categoria?: string | null;
    prioridade?: string | null;
    precisaRetorno: boolean;
    createdAt: string;
    updatedAt: string;
  };
  municipes: {
    id: string;
    name: string;
    phone: string;
    demandCount: number;
    bairro: string | null;
  };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const formatName = (name: string) => {
  if (!name) return '';
  return name.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

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
      page: pagination.page.toString(),
      limit: pagination.limit.toString(),
      search: searchTerm,
      attention: filterByAttention.toString(),
      sortBy: sortConfig.key,
      sortOrder: sortConfig.direction
    });

    api.get(`/demands/atendimentos?${params.toString()}`)
      .then(res => {
        setAtendimentos(res.data.data || []);
        setPagination(res.data.pagination || { page: 1, limit: 25, total: 0, totalPages: 0 });
      })
      .catch(err => console.error(err))
      .finally(() => {
        if (!isBackground) setLoading(false);
      });
  }, [pagination.page, pagination.limit, searchTerm, filterByAttention, sortConfig]);

  useEffect(() => {
    fetchAtendimentos();
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchAtendimentos(true);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchAtendimentos]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgente': return 'text-red-600 bg-red-50';
      case 'alta': return 'text-orange-600 bg-orange-50';
      case 'media': return 'text-amber-600 bg-amber-50';
      case 'baixa': return 'text-emerald-600 bg-emerald-50';
      default: return 'text-slate-600 bg-slate-50';
    }
  };

  const exportToPDF = async (mode: 'page' | 'all') => {
    setExporting(true);
    try {
      let dataToExport = atendimentos;
      if (mode === 'all') {
        const res = await api.get(`/demands/atendimentos?limit=1000&sortBy=${sortConfig.key}&sortOrder=${sortConfig.direction}`);
        dataToExport = res.data.data;
      }

      const doc = new jsPDF();
      doc.setFillColor(30, 41, 59);
      doc.rect(0, 0, 210, 40, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('RELATÓRIO DE ATENDIMENTOS', 14, 20);
      doc.setFontSize(10);
      doc.text('CRM DO VERÊ - GESTÃO DE GABINETE', 14, 28);
      doc.text(`GERADO EM: ${new Date().toLocaleString('pt-BR')}`, 140, 28);

      const tableData = dataToExport.map(a => [
        a.municipes.name,
        formatPhone(a.municipes.phone),
        a.atendimentos.categoria || 'OUTRO',
        a.atendimentos.prioridade || 'baixa',
        new Date(a.atendimentos.updatedAt).toLocaleDateString('pt-BR')
      ]);

      autoTable(doc, {
        startY: 45,
        head: [['NOME', 'WHATSAPP', 'CATEGORIA', 'PRIORIDADE', 'DATA']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] }
      });

      doc.save(`atendimentos-${new Date().getTime()}.pdf`);
      setIsExportModalOpen(false);
    } catch (err) {
      alert('Erro ao exportar PDF');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <MessageSquare className="text-blue-600" size={32} />
            Atendimento
          </h1>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Histórico WhatsApp e IA</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsNewDemandModalOpen(true)} className="px-4 py-2.5 bg-blue-600 text-white rounded-xl font-black text-sm flex items-center gap-2 shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all">
            <Plus size={18} /> ADICIONAR
          </button>
          <button 
            onClick={() => setIsExportModalOpen(true)}
            className="p-2.5 bg-white border border-slate-200 text-slate-400 rounded-xl hover:text-blue-600 hover:bg-blue-50 transition-all shadow-sm"
          >
            <FileDown size={20} />
          </button>
        </div>
      </header>

      <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1 group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={16} />
          <input 
            type="text"
            placeholder="Buscar por munícipe ou telefone..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-transparent rounded-xl outline-none focus:bg-white focus:border-blue-200 transition-all font-bold text-sm"
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
          />
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setFilterByAttention(!filterByAttention)}
            className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border ${
              filterByAttention ? 'bg-red-500 border-red-400 text-white shadow-md' : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100'
            }`}
          >
            Atenção
          </button>
          <select 
            className="px-3 py-2.5 bg-slate-50 border border-transparent text-slate-600 rounded-xl outline-none font-bold text-xs"
            value={pagination.limit}
            onChange={e => setPagination(prev => ({ ...prev, limit: parseInt(e.target.value), page: 1 }))}
          >
            <option value="25">25 / pág</option>
            <option value="50">50 / pág</option>
            <option value="100">100 / pág</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden relative min-h-[300px]">
        {loading && <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={32} /></div>}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="pl-6 py-4 cursor-pointer hover:text-blue-600 transition-colors" onClick={() => handleSort('municipes.name')}>
                  <div className="flex items-center gap-1">Munícipe <ArrowUpDown size={12} /></div>
                </th>
                <th className="px-4 py-4">WhatsApp</th>
                <th className="px-4 py-4 cursor-pointer hover:text-blue-600 transition-colors" onClick={() => handleSort('atendimentos.categoria')}>
                  <div className="flex items-center gap-1">Categoria <ArrowUpDown size={12} /></div>
                </th>
                <th className="px-4 py-4 cursor-pointer hover:text-blue-600 transition-colors" onClick={() => handleSort('atendimentos.prioridade')}>
                  <div className="flex items-center gap-1">Prioridade <ArrowUpDown size={12} /></div>
                </th>
                <th className="px-6 py-4 text-right cursor-pointer hover:text-blue-600 transition-colors" onClick={() => handleSort('atendimentos.updatedAt')}>
                  <div className="flex items-center justify-end gap-1">Data <ArrowUpDown size={12} /></div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {atendimentos.length === 0 && !loading ? (
                <tr>
                  <td colSpan={5} className="p-20 text-center text-slate-300 font-black text-xs uppercase tracking-widest">Nenhum atendimento encontrado</td>
                </tr>
              ) : atendimentos.map(a => (
                <tr 
                  key={a.atendimentos.id} 
                  className={`group hover:bg-slate-50/50 transition-all cursor-pointer ${a.atendimentos.precisaRetorno ? 'bg-red-50/30' : ''}`}
                  onClick={() => setSelectedAtendimento(a)}
                >
                  <td className="pl-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{formatName(a.municipes.name)}</span>
                      {a.atendimentos.precisaRetorno && <span className="bg-red-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase">EQUIPE</span>}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-xs font-bold text-slate-600">{formatPhone(a.municipes.phone)}</div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{a.atendimentos.categoria?.replace('_', ' ') || 'OUTRO'}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${getPriorityColor(a.atendimentos.prioridade || 'baixa')}`}>
                      {a.atendimentos.prioridade || 'baixa'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-xs font-bold text-slate-400">
                    {new Date(a.atendimentos.updatedAt).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Rodapé com Paginação */}
        <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {pagination.total} ATENDIMENTOS • PÁGINA {pagination.page} DE {pagination.totalPages}
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
      </div>

      {/* Modal de Exportação */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900">Exportar Atendimentos</h3>
              <button onClick={() => setIsExportModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-3">
              <button 
                onClick={() => exportToPDF('page')}
                disabled={exporting}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-left hover:border-blue-500 hover:bg-blue-50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-white p-2 rounded-xl text-slate-400 group-hover:text-blue-600 shadow-sm"><FileDown size={20} /></div>
                  <div>
                    <p className="font-bold text-slate-900">Página Atual</p>
                    <p className="text-xs text-slate-500">Exportar os {atendimentos.length} desta página</p>
                  </div>
                </div>
              </button>
              <button 
                onClick={() => exportToPDF('all')}
                disabled={exporting}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-left hover:border-blue-500 hover:bg-blue-50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-white p-2 rounded-xl text-slate-400 group-hover:text-blue-600 shadow-sm"><Users size={20} /></div>
                  <div>
                    <p className="font-bold text-slate-900">Histórico Completo</p>
                    <p className="text-xs text-slate-500">Exportar todos os {pagination.total} registros</p>
                  </div>
                </div>
              </button>
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
              prioridade: selectedAtendimento.atendimentos.prioridade || 'media'
            },
            atendimentoId: selectedAtendimento.atendimentos.id,
            municipes: selectedAtendimento.municipes
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

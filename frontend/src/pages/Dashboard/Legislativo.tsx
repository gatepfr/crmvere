import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../api/client';
import NewDemandModal from '../../components/NewDemandModal';
import DemandModal from '../../components/DemandModal';
import { 
  ClipboardList, 
  Search, 
  MessageSquare, 
  CheckCircle2, 
  Circle, 
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
  ArrowDown
} from 'lucide-react';

interface Demand {
  id: string;
  descricao: string;
  categoria: string;
  status: string;
  isLegislativo: boolean;
  numeroIndicacao: string | null;
  documentUrl: string | null;
  createdAt: string;
  municipes: {
    id: string;
    name: string;
    phone: string;
    bairro: string | null;
  };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

type SortField = 'name' | 'subject' | 'number' | 'date';
type SortOrder = 'asc' | 'desc';

export default function Legislativo() {
  const [demands, setDemands] = useState<Demand[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [onlyPending, setOnlyPending] = useState(false);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedDemand, setSelectedDemand] = useState<any>(null);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  
  // Sorting state
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const loadDemands = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        search: searchTerm
      });
      const res = await api.get(`/demands?${params.toString()}`);
      setDemands(res.data.data.map((d: any) => ({
        ...d.demandas,
        municipes: d.municipes
      })));
      setPagination(res.data.pagination);
    } catch (err) {
      console.error('Erro ao carregar dados legislativos');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, searchTerm]);

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
      alert('Erro ao atualizar status legislativo');
    }
  };

  const updateDocUrl = async (d: Demand) => {
    // Se já tiver link, ele aparece pré-preenchido no prompt
    const url = prompt('Cole o link do PDF ou da Indicação no site da Câmara:', d.documentUrl || '');
    if (url === null) return;
    try {
      await api.patch(`/demands/${d.id}/status`, { documentUrl: url });
      loadDemands();
    } catch (err) {
      alert('Erro ao atualizar link');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta indicação? Esta ação não pode ser desfeita.')) return;
    try {
      await api.delete(`/demands/${id}`);
      setDemands(prev => prev.filter(d => d.id !== id));
      alert('Excluído com sucesso!');
    } catch (err) {
      alert('Erro ao excluir.');
    }
  };

  const sendToWhatsApp = async (d: Demand) => {
    if (!d.documentUrl) {
      alert('Adicione o link da indicação primeiro!');
      return;
    }
    const msg = `Olá ${d.municipes.name}! Gostaria de informar que sua solicitação sobre *${d.categoria.toUpperCase()}* virou a Indicação oficial nº *${d.numeroIndicacao}*. Você pode acompanhar por aqui: ${d.documentUrl}`;
    
    try {
      await api.post('/whatsapp/send-direct', {
        phone: d.municipes.phone,
        message: msg
      });
      alert('Link enviado com sucesso!');
    } catch (err) {
      alert('Erro ao enviar WhatsApp.');
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

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-10">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <ClipboardList className="text-blue-600" size={32} />
            Indicações Legislativas
          </h1>
          <div className="flex items-center gap-4 mt-1">
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Transformando demandas em proposituras</p>
            <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black border border-blue-100 uppercase">
              {pagination.total} TOTAL
            </span>
          </div>
        </div>
        <button 
          onClick={() => setIsNewModalOpen(true)}
          className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-sm hover:bg-blue-700 transition-all flex items-center gap-2 shadow-xl shadow-blue-200"
        >
          <Plus size={20} />
          NOVA INDICAÇÃO
        </button>
      </header>

      <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100 flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text"
            placeholder="Buscar por nome, bairro ou assunto..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-transparent rounded-xl outline-none focus:bg-white focus:border-blue-200 transition-all font-bold text-sm"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <button 
          onClick={() => setOnlyPending(!onlyPending)}
          className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border w-full md:w-auto flex items-center justify-center gap-2 ${
            onlyPending ? 'bg-amber-500 border-amber-400 text-white shadow-lg' : 'bg-slate-50 border-transparent text-slate-500'
          }`}
        >
          <AlertCircle size={14} />
          Pendentes de Protocolo
        </button>

        <div className="h-8 w-[1px] bg-slate-100 mx-1 hidden lg:block"></div>

        <select
          className="px-3 py-2.5 bg-slate-50 border border-transparent text-slate-600 rounded-xl outline-none font-bold text-xs"
          value={pagination.limit === 10000 ? 'all' : pagination.limit}
          onChange={e => setPagination(prev => ({ ...prev, limit: e.target.value === 'all' ? 10000 : parseInt(e.target.value), page: 1 }))}
        >
          <option value="25">25 / pág</option>
          <option value="50">50 / pág</option>
          <option value="all">Ver Todos</option>
        </select>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden relative min-h-[300px]">
        {loading && <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={32} /></div>}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-6 py-4 w-1/4 cursor-pointer group" onClick={() => toggleSort('name')}>
                  <div className="flex items-center gap-1.5 group-hover:text-blue-600 transition-colors">
                    Munícipe <SortIcon field="name" />
                  </div>
                </th>
                <th className="px-6 py-4 w-2/5 cursor-pointer group" onClick={() => toggleSort('subject')}>
                  <div className="flex items-center gap-1.5 group-hover:text-blue-600 transition-colors">
                    Assunto Detalhado <SortIcon field="subject" />
                  </div>
                </th>
                <th className="px-6 py-4 text-center cursor-pointer group" onClick={() => toggleSort('number')}>
                  <div className="flex items-center justify-center gap-1.5 group-hover:text-blue-600 transition-colors">
                    Nº Indicação <SortIcon field="number" />
                  </div>
                </th>
                <th className="px-6 py-4 text-center w-32">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sortedDemands.map(d => (
                <tr key={d.id} className="group hover:bg-slate-50/30 transition-all align-top">
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{d.municipes.name}</span>
                      <span className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1 mt-1">
                        <MapPin size={10} /> {d.municipes.bairro || 'Centro'}
                      </span>
                      <div className="mt-3 flex items-center gap-2">
                         <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[9px] font-black uppercase border border-blue-100">
                           {d.categoria}
                         </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap font-medium">
                      {d.descricao}
                    </div>
                    {d.documentUrl && (
                      <a 
                        href={d.documentUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 mt-3 text-blue-600 font-bold text-[10px] uppercase hover:underline"
                      >
                        <FileText size={12} /> Ver documento oficial
                      </a>
                    )}
                  </td>
                  <td className="px-6 py-5 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <button 
                        onClick={() => toggleLegislativo(d.id, d.isLegislativo)}
                        className={`w-full py-1.5 px-3 rounded-lg text-[10px] font-black uppercase border transition-all ${
                          d.isLegislativo 
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-600' 
                            : 'bg-white border-slate-200 text-slate-400 hover:border-blue-400 hover:text-blue-500'
                        }`}
                      >
                        {d.isLegislativo ? `Indicação ${d.numeroIndicacao || 'S/N'}` : 'Não protocolada'}
                      </button>
                      
                      {d.isLegislativo && (
                        <button 
                          onClick={() => sendToWhatsApp(d)}
                          className="flex items-center gap-1.5 text-blue-500 hover:text-blue-700 font-bold text-[10px] uppercase transition-colors"
                        >
                          <Send size={12} /> Avisar no WhatsApp
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex justify-end items-center gap-1">
                      <button 
                        onClick={() => setSelectedDemand({ demandas: d, municipes: d.municipes })}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                        title="Editar Detalhes"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => updateDocUrl(d)}
                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                        title="Anexar Link PDF"
                      >
                        <FileText size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(d.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                        title="Excluir Indicação"
                      >
                        <Trash2 size={18} />
                      </button>
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
            {pagination.total} DEMANDAS • PÁGINA {pagination.page} DE {pagination.totalPages}
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

      {isNewModalOpen && (
        <NewDemandModal 
          onClose={() => setIsNewModalOpen(false)} 
          onUpdate={loadDemands} 
        />
      )}

      {selectedDemand && (
        <DemandModal 
          demand={selectedDemand} 
          onClose={() => setSelectedDemand(null)} 
          onUpdate={loadDemands} 
        />
      )}
    </div>
  );
}

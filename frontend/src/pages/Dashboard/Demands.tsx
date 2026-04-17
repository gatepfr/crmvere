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
  Trash2
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  const [selectedAtendimento, setSelectedAtendimento] = useState<any>(null);
  const [isNewDemandModalOpen, setIsNewDemandModalOpen] = useState(false);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterByAttention, setFilterByAttention] = useState(false);

  const fetchAtendimentos = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: pagination.page.toString(),
      limit: pagination.limit.toString(),
      search: searchTerm,
      attention: filterByAttention.toString()
    });

    api.get(`/demands/atendimentos?${params.toString()}`)
      .then(res => {
        setAtendimentos(res.data.data || []);
        setPagination(res.data.pagination || { page: 1, limit: 25, total: 0, totalPages: 0 });
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [pagination.page, pagination.limit, searchTerm, filterByAttention]);

  useEffect(() => {
    fetchAtendimentos();
    const interval = setInterval(() => {
      api.get(`/demands/atendimentos?page=1&limit=25&search=${searchTerm}&attention=${filterByAttention}`)
        .then(res => setAtendimentos(res.data.data || []))
        .catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchAtendimentos, searchTerm, filterByAttention]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgente': return 'text-red-600 bg-red-50';
      case 'alta': return 'text-orange-600 bg-orange-50';
      case 'media': return 'text-amber-600 bg-amber-50';
      case 'baixa': return 'text-emerald-600 bg-emerald-50';
      default: return 'text-slate-600 bg-slate-50';
    }
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, '');
    
    // Remove o 55 se existir
    if (cleaned.startsWith('55') && cleaned.length >= 12) {
      cleaned = cleaned.slice(2);
    }
    
    // Se tiver 10 dígitos (DDD + 8), adiciona o 9 para a máscara
    if (cleaned.length === 10) {
      cleaned = cleaned.slice(0, 2) + '9' + cleaned.slice(2);
    }
    
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    
    return phone;
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
        <button onClick={() => setIsNewDemandModalOpen(true)} className="px-4 py-2.5 bg-blue-600 text-white rounded-xl font-black text-sm flex items-center gap-2 shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all">
          <Plus size={18} /> ADICIONAR
        </button>
      </header>

      <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100 flex gap-3">
        <div className="relative flex-1 group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={16} />
          <input 
            type="text"
            placeholder="Buscar por munícipe ou telefone..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-transparent rounded-xl outline-none focus:bg-white focus:border-blue-200 transition-all font-bold text-sm"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <button 
          onClick={() => setFilterByAttention(!filterByAttention)}
          className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border ${
            filterByAttention ? 'bg-red-500 border-red-400 text-white shadow-md' : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100'
          }`}
        >
          Atenção
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden relative">
        {loading && <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={32} /></div>}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="pl-6 py-4">Munícipe</th>
                <th className="px-4 py-4">WhatsApp</th>
                <th className="px-4 py-4">Categoria</th>
                <th className="px-4 py-4">Prioridade</th>
                <th className="px-6 py-4 text-right">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {atendimentos.map(a => (
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
      </div>

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

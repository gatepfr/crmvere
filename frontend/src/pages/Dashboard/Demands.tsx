import { useEffect, useState, useMemo, useCallback } from 'react';
import api from '../../api/client';
import DemandModal from '../../components/DemandModal';
import NewDemandModal from '../../components/NewDemandModal';
import { 
  FileDown, 
  Loader2, 
  MessageSquare, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Plus, 
  Search, 
  Clock,
  ChevronLeft,
  ChevronRight,
  Phone,
  ClipboardList
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Atendimento {
  atendimentos: {
    id: string;
    resumoIa: string;
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

type SortField = 'name' | 'phone' | 'date';
type SortOrder = 'asc' | 'desc';

const formatName = (name: string) => {
  if (!name) return '';
  const prepositions = ['de', 'da', 'do', 'das', 'dos', 'e'];
  return name
    .toLowerCase()
    .split(' ')
    .filter(word => word.length > 0)
    .map((word, index) => {
      if (prepositions.includes(word) && index !== 0) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
};

export default function Demands() {
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAtendimento, setSelectedAtendimento] = useState<any>(null);
  const [isNewDemandModalOpen, setIsNewDemandModalOpen] = useState(false);
  const [prefilledMunicipe, setPrefilledMunicipe] = useState<any>(null);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterByAttention, setFilterByAttention] = useState(false);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

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
  }, [fetchAtendimentos]);

  const formatPhone = (phone: string) => {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.length >= 12 && cleaned.startsWith('55')) cleaned = cleaned.slice(2);
    if (cleaned.length === 10) cleaned = cleaned.slice(0, 2) + '9' + cleaned.slice(2);
    if (cleaned.length === 11) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    return phone;
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text('Relatório de Atendimentos WhatsApp', 14, 20);
    const tableData = atendimentos.map(a => [
      a.municipes.name,
      formatPhone(a.municipes.phone),
      new Date(a.atendimentos.updatedAt).toLocaleDateString('pt-BR')
    ]);
    autoTable(doc, { head: [['Munícipe', 'WhatsApp', 'Última Interação']], body: tableData });
    doc.save(`atendimentos.pdf`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <MessageSquare className="text-blue-600" size={32} />
            Atendimento (WhatsApp)
          </h1>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Conversas e Resumos da IA</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportToPDF} className="p-2.5 bg-white border border-slate-200 text-slate-400 rounded-xl hover:text-blue-600 transition-all shadow-sm">
            <FileDown size={20} />
          </button>
        </div>
      </header>

      <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100 flex gap-3">
        <div className="relative flex-1 group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
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
            filterByAttention ? 'bg-red-500 border-red-400 text-white shadow-md' : 'bg-slate-50 border-transparent text-slate-500'
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
                <th className="px-4 py-4">Última Mensagem</th>
                <th className="px-6 py-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {atendimentos.map(a => (
                <tr key={a.atendimentos.id} className={`group hover:bg-slate-50/50 transition-all cursor-pointer ${a.atendimentos.precisaRetorno ? 'bg-red-50/30' : ''}`}>
                  <td className="pl-6 py-4" onClick={() => setSelectedAtendimento(a)}>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{formatName(a.municipes.name)}</span>
                      {a.atendimentos.precisaRetorno && <span className="bg-red-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase">EQUIPE</span>}
                    </div>
                  </td>
                  <td className="px-4 py-4" onClick={() => setSelectedAtendimento(a)}>
                    <span className="text-xs font-bold text-slate-600">{formatPhone(a.municipes.phone)}</span>
                  </td>
                  <td className="px-4 py-4" onClick={() => setSelectedAtendimento(a)}>
                    <span className="text-xs text-slate-400 font-medium">{new Date(a.atendimentos.updatedAt).toLocaleString('pt-BR')}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setSelectedAtendimento(a); }}
                      className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                      title="Transformar em Demanda Oficial"
                    >
                      <ClipboardList size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {pagination.total} REGISTROS • PÁGINA {pagination.page} DE {pagination.totalPages}
          </p>
          <div className="flex gap-1">
            <button disabled={pagination.page === 1} onClick={() => setPagination(p => ({...p, page: p.page - 1}))} className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 disabled:opacity-30"><ChevronLeft size={16} /></button>
            <button disabled={pagination.page === pagination.totalPages} onClick={() => setPagination(p => ({...p, page: p.page + 1}))} className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 disabled:opacity-30"><ChevronRight size={16} /></button>
          </div>
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
              status: 'nova',
              categoria: 'outro',
              prioridade: 'media'
            },
            municipes: selectedAtendimento.municipes
          }}
          onClose={() => setSelectedAtendimento(null)}
          onUpdate={fetchAtendimentos}
          onOpenCreateDemand={(municipe: any) => {
            setPrefilledMunicipe(municipe);
            setSelectedAtendimento(null);
            setIsNewDemandModalOpen(true);
          }}
        />
      )}

      {isNewDemandModalOpen && (
        <NewDemandModal 
          onClose={() => {
            setIsNewDemandModalOpen(false);
            setPrefilledMunicipe(null);
          }} 
          onUpdate={fetchAtendimentos} 
          prefilledMunicipe={prefilledMunicipe}
        />
      )}
    </div>
  );
}

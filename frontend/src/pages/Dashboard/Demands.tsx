import { useEffect, useState, useMemo } from 'react';
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
  MoreVertical
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Demand {
  demandas: {
    id: string;
    categoria: string;
    status: string;
    prioridade: string;
    precisaRetorno: boolean;
    createdAt: string;
  };
  municipes: {
    name: string;
    phone: string;
  };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

type SortField = 'name' | 'phone' | 'date' | 'priority' | 'category';
type SortOrder = 'asc' | 'desc';

export default function Demands() {
  const [demands, setDemands] = useState<Demand[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDemand, setSelectedDemand] = useState<any>(null);
  const [isNewDemandModalOpen, setIsNewDemandModalOpen] = useState(false);
  const [filterByAttention, setFilterByAttention] = useState(false);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 10, total: 0, totalPages: 0 });
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const fetchDemands = () => {
    setLoading(true);
    api.get(`/demands?page=${pagination.page}&limit=${pagination.limit}`)
      .then(res => {
        setDemands(res.data.data || []);
        setPagination(res.data.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 });
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDemands();
  }, [pagination.page, pagination.limit]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'nova': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'em_andamento': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'concluida': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'cancelada': return 'bg-slate-50 text-slate-500 border-slate-100';
      default: return 'bg-gray-50 text-gray-600 border-gray-100';
    }
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

  const formatPhone = (phone: string) => {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.length >= 12 && cleaned.startsWith('55')) cleaned = cleaned.slice(2);
    if (cleaned.length === 10) cleaned = cleaned.slice(0, 2) + '9' + cleaned.slice(2);
    if (cleaned.length === 11) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    return phone;
  };

  const filteredAndSortedDemands = useMemo(() => {
    return demands
      .filter(d => {
        const nameMatch = d.municipes.name.toLowerCase().includes(searchTerm.toLowerCase());
        const phoneMatch = d.municipes.phone.includes(searchTerm);
        const matchesCategory = !filterCategory || d.demandas.categoria === filterCategory;
        const matchesStatus = !filterStatus || d.demandas.status === filterStatus;
        const matchesPriority = !filterPriority || d.demandas.prioridade === filterPriority;
        const matchesAttention = !filterByAttention || d.demandas.precisaRetorno;
        return (nameMatch || phoneMatch) && matchesCategory && matchesStatus && matchesPriority && matchesAttention;
      })
      .sort((a, b) => {
        let valA: any, valB: any;
        
        switch (sortField) {
          case 'name':
            valA = a.municipes.name.toLowerCase();
            valB = b.municipes.name.toLowerCase();
            break;
          case 'phone':
            valA = a.municipes.phone;
            valB = b.municipes.phone;
            break;
          case 'category':
            valA = a.demandas.categoria.toLowerCase();
            valB = b.demandas.categoria.toLowerCase();
            break;
          case 'priority':
            const pOrder = { urgente: 4, alta: 3, media: 2, baixa: 1 };
            valA = pOrder[a.demandas.prioridade as keyof typeof pOrder] || 0;
            valB = pOrder[b.demandas.prioridade as keyof typeof pOrder] || 0;
            break;
          case 'date':
          default:
            valA = new Date(a.demandas.createdAt).getTime();
            valB = new Date(b.demandas.createdAt).getTime();
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [demands, searchTerm, filterCategory, filterStatus, filterPriority, filterByAttention, sortField, sortOrder]);

  const handleOpenDemand = (id: string) => {
    const demand = demands.find(d => d.demandas.id === id);
    setSelectedDemand(demand);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Relatório de Demandas - CRM do Verê', 14, 20);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 28);
    
    const tableData = filteredAndSortedDemands.map(d => [
      d.municipes.name,
      d.demandas.categoria,
      d.demandas.status,
      d.demandas.prioridade,
      new Date(d.demandas.createdAt).toLocaleDateString('pt-BR')
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['Munícipe', 'Categoria', 'Status', 'Prioridade', 'Data']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [30, 41, 59] }
    });

    doc.save(`demandas-${new Date().getTime()}.pdf`);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-100" />;
    return sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
  };

  if (loading && pagination.page === 1) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <ClipboardList className="text-blue-600" size={32} />
            Demandas
          </h1>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Gestão de atendimentos e solicitações</p>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsNewDemandModalOpen(true)}
            className="flex-1 lg:flex-none px-4 py-2.5 bg-blue-600 text-white rounded-xl font-black text-sm hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
          >
            <Plus size={18} />
            ADICIONAR
          </button>

          <button 
            onClick={exportToPDF}
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
            placeholder="Buscar por munícipe ou telefone..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-transparent rounded-xl outline-none focus:bg-white focus:border-blue-200 transition-all font-bold text-sm"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <select 
              className="pl-4 pr-10 py-2.5 bg-slate-50 border border-transparent rounded-xl outline-none focus:bg-white focus:border-blue-200 transition-all font-bold text-sm appearance-none min-w-[150px]"
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
            >
              <option value="">Categorias</option>
              <option value="saude">Saúde</option>
              <option value="infraestrutura">Infraestrutura</option>
              <option value="seguranca">Segurança</option>
              <option value="educacao">Educação</option>
              <option value="funcionario_publico">Func. Público</option>
              <option value="outro">Outros</option>
            </select>
            <Tag className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
          </div>

          <div className="relative">
            <select 
              className="pl-4 pr-10 py-2.5 bg-slate-50 border border-transparent rounded-xl outline-none focus:bg-white focus:border-blue-200 transition-all font-bold text-sm appearance-none min-w-[140px]"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
            >
              <option value="">Status</option>
              <option value="nova">Nova</option>
              <option value="em_andamento">Em Andamento</option>
              <option value="concluida">Concluída</option>
              <option value="cancelada">Cancelada</option>
            </select>
            <Clock className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
          </div>

          <button 
            onClick={() => setFilterByAttention(!filterByAttention)}
            className={`px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border ${
              filterByAttention ? 'bg-red-500 border-red-400 text-white shadow-md' : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100'
            }`}
          >
            Atenção
          </button>

          <div className="h-8 w-[1px] bg-slate-100 mx-1 hidden xl:block"></div>

          <select
            className="px-3 py-2.5 bg-slate-50 border border-transparent text-slate-600 rounded-xl outline-none font-bold text-xs"
            value={pagination.limit}
            onChange={e => setPagination(prev => ({ ...prev, limit: e.target.value === 'all' ? 10000 : parseInt(e.target.value), page: 1 }))}
          >
            <option value="10">10 / pág</option>
            <option value="25">25 / pág</option>
            <option value="50">50 / pág</option>
            <option value="all">Ver Todos</option>
          </select>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Mobile View */}
        <div className="lg:hidden divide-y divide-slate-50">
          {filteredAndSortedDemands.map((demand: Demand) => (
            <div 
              key={demand.demandas.id} 
              className={`p-4 transition-all active:bg-slate-50 ${demand.demandas.precisaRetorno ? 'bg-red-50/40' : ''}`}
              onClick={() => handleOpenDemand(demand.demandas.id)}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="font-bold text-slate-900 flex items-center gap-2">
                    {demand.municipes.name}
                    {demand.demandas.precisaRetorno && (
                      <span className="bg-red-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase">EQUIPE</span>
                    )}
                  </h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">{formatPhone(demand.municipes.phone)}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border uppercase ${getStatusColor(demand.demandas.status)}`}>
                  {demand.demandas.status.replace('_', ' ')}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-slate-100 rounded-lg text-[9px] font-black text-slate-500 uppercase">{demand.demandas.categoria.replace('_', ' ')}</span>
                <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${getPriorityColor(demand.demandas.prioridade)}`}>{demand.demandas.prioridade}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop View */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="pl-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer group" onClick={() => toggleSort('name')}>
                  <div className="flex items-center gap-1 group-hover:text-blue-600 transition-colors">
                    Munícipe <SortIcon field="name" />
                  </div>
                </th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer group" onClick={() => toggleSort('phone')}>
                  <div className="flex items-center gap-1 group-hover:text-blue-600 transition-colors">
                    Contato <SortIcon field="phone" />
                  </div>
                </th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer group" onClick={() => toggleSort('category')}>
                  <div className="flex items-center gap-1 group-hover:text-blue-600 transition-colors">
                    Categoria <SortIcon field="category" />
                  </div>
                </th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer group" onClick={() => toggleSort('priority')}>
                  <div className="flex items-center gap-1 group-hover:text-blue-600 transition-colors">
                    Prioridade <SortIcon field="priority" />
                  </div>
                </th>
                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer group" onClick={() => toggleSort('date')}>
                  <div className="flex items-center justify-end gap-1 group-hover:text-blue-600 transition-colors">
                    Data <SortIcon field="date" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredAndSortedDemands.map((demand: Demand) => (
                <tr 
                  key={demand.demandas.id} 
                  className={`group hover:bg-slate-50/50 transition-all cursor-pointer ${demand.demandas.precisaRetorno ? 'bg-red-50/30' : ''}`}
                  onClick={() => handleOpenDemand(demand.demandas.id)}
                >
                  <td className="pl-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{demand.municipes.name}</span>
                      {demand.demandas.precisaRetorno && (
                        <span className="bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm">EQUIPE</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                      <Phone size={12} className="text-slate-300" />
                      {formatPhone(demand.municipes.phone)}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{demand.demandas.categoria.replace('_', ' ')}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border uppercase ${getStatusColor(demand.demandas.status)}`}>
                      {demand.demandas.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${getPriorityColor(demand.demandas.prioridade)}`}>
                      {demand.demandas.prioridade}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-xs font-bold text-slate-400">
                      {new Date(demand.demandas.createdAt).toLocaleDateString('pt-BR')}
                    </span>
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

        {filteredAndSortedDemands.length === 0 && !loading && (
          <div className="p-20 text-center">
            <ClipboardList size={40} className="text-slate-200 mx-auto mb-3" />
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Nenhuma demanda encontrada</h3>
          </div>
        )}
      </div>

      {selectedDemand && (
        <DemandModal 
          demand={selectedDemand} 
          onClose={() => setSelectedDemand(null)} 
          onUpdate={fetchDemands} 
        />
      )}

      {isNewDemandModalOpen && (
        <NewDemandModal 
          onClose={() => setIsNewDemandModalOpen(false)} 
          onUpdate={fetchDemands} 
        />
      )}
    </div>
  );
}

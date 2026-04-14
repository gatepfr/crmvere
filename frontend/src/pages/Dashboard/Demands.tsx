import { useEffect, useState, useMemo } from 'react';
import api from '../../api/client';
import DemandModal from '../../components/DemandModal';
import NewDemandModal from '../../components/NewDemandModal';
import { 
  FileDown, 
  Download, 
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
  ChevronRight
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

type SortField = 'name' | 'date' | 'priority' | 'category';
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
  }, [pagination.page]);

  const priorityWeight: Record<string, number> = {
    'urgente': 4,
    'alta': 3,
    'media': 2,
    'baixa': 1,
    'outro': 0
  };

  const attentionCount = demands.filter(d => d.demandas.precisaRetorno).length;

  const filteredDemands = useMemo(() => {
    return demands.filter(d => {
      const matchesSearch = d.municipes.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           d.municipes.phone.includes(searchTerm);
      const matchesCategory = !filterCategory || d.demandas.categoria === filterCategory;
      const matchesStatus = !filterStatus || d.demandas.status === filterStatus;
      const matchesPriority = !filterPriority || d.demandas.prioridade === filterPriority;
      const matchesAttention = !filterByAttention || d.demandas.precisaRetorno;
      
      return matchesSearch && matchesCategory && matchesStatus && matchesPriority && matchesAttention;
    });
  }, [demands, searchTerm, filterCategory, filterStatus, filterPriority, filterByAttention]);

  const sortedDemands = useMemo(() => {
    const sorted = [...filteredDemands];
    sorted.sort((a: Demand, b: Demand) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'name':
          comparison = a.municipes.name.localeCompare(b.municipes.name);
          break;
        case 'category':
          comparison = a.demandas.categoria.localeCompare(b.demandas.categoria);
          break;
        case 'date':
          comparison = new Date(a.demandas.createdAt).getTime() - new Date(b.demandas.createdAt).getTime();
          break;
        case 'priority':
          const weightA = priorityWeight[a.demandas.prioridade.toLowerCase()] || 0;
          const weightB = priorityWeight[b.demandas.prioridade.toLowerCase()] || 0;
          comparison = weightA - weightB;
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [filteredDemands, sortField, sortOrder]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={14} className="ml-1 opacity-30" />;
    return sortOrder === 'asc' ? <ArrowUp size={14} className="ml-1 text-blue-600" /> : <ArrowDown size={14} className="ml-1 text-blue-600" />;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'nova': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'em_andamento': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'concluida': return 'bg-green-50 text-green-700 border-green-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'alta': return 'text-red-700';
      case 'urgente': return 'text-red-900 font-bold';
      case 'media': return 'text-orange-700';
      default: return 'text-gray-700';
    }
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    const tableHeaders = [['Protocolo', 'Cidadao', 'Categoria', 'Status', 'Data']];
    const tableData = sortedDemands.map((d: Demand) => [
      `MUN-${new Date(d.demandas.createdAt).getFullYear()}-${d.demandas.id.slice(0, 5).toUpperCase()}`,
      d.municipes.name,
      d.demandas.categoria,
      d.demandas.status,
      new Date(d.demandas.createdAt).toLocaleDateString('pt-BR')
    ]);

    doc.text('Relatorio de Demandas - VereadorCRM', 14, 15);
    autoTable(doc, {
      head: tableHeaders,
      body: tableData,
      startY: 20,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] }
    });

    doc.save(`demandas_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handleOpenDemand = async (id: string) => {
    try {
      const res = await api.get(`/demands/${id}`);
      setSelectedDemand(res.data);
    } catch (err) {
      console.error('Erro ao buscar detalhes:', err);
    }
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, '');
    
    // Logic: if it starts with 55, remove it for easier handling
    if (cleaned.length >= 12 && cleaned.startsWith('55')) {
      cleaned = cleaned.slice(2);
    }
    
    // Intelligent Fix: If it has 10 digits, it's missing the 9. Add it.
    if (cleaned.length === 10) {
      cleaned = cleaned.slice(0, 2) + '9' + cleaned.slice(2);
    }
    
    // Final format (99) 99999-9999
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
        <span className="ml-2 text-gray-600 font-medium">Carregando demandas...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center">
            <ClipboardList className="mr-3 h-8 w-8 text-blue-600" />
            Fila de Demandas
          </h1>
          <p className="text-slate-500 mt-1">Gerencie e responda as solicitações recebidas via WhatsApp.</p>
        </div>
        
        <div className="flex gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
          <button 
            onClick={() => setFilterByAttention(!filterByAttention)}
            className={`flex-1 md:flex-none flex items-center justify-center px-4 py-2.5 rounded-xl font-bold transition-all border ${
              filterByAttention 
                ? 'bg-red-600 text-white border-red-600 shadow-lg shadow-red-200' 
                : 'bg-white text-slate-700 border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
            }`}
          >
            <AlertCircle className={`mr-2 h-5 w-5 ${filterByAttention ? 'text-white' : 'text-red-500'}`} />
            <span className="whitespace-nowrap">Atenção</span>
            {attentionCount > 0 && (
              <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-black ${
                filterByAttention ? 'bg-white text-red-600' : 'bg-red-600 text-white'
              }`}>
                {attentionCount}
              </span>
            )}
          </button>

          <button 
            onClick={() => setIsNewDemandModalOpen(true)}
            className="flex-1 md:flex-none flex items-center justify-center px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
          >
            <Plus className="mr-2 h-5 w-5" />
            Nova Demanda
          </button>
          
          <button 
            onClick={exportPDF}
            className="flex-1 md:flex-none flex items-center justify-center px-4 py-2.5 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
          >
            <FileDown className="mr-2 h-4 w-4" />
            PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-white p-4 md:p-6 rounded-3xl shadow-sm border border-slate-200">
        <div className="relative">
          <Search className="absolute left-3 top-3 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Buscar por munícipe..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="relative">
          <Tag className="absolute left-3 top-3 text-slate-400" size={18} />
          <select 
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 appearance-none text-sm font-medium"
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
          >
            <option value="">Todas Categorias</option>
            <option value="saude">Saúde</option>
            <option value="infraestrutura">Infraestrutura</option>
            <option value="seguranca">Segurança</option>
            <option value="educacao">Educação</option>
            <option value="funcionario_publico">Funcionário Público</option>
            <option value="outro">Outros</option>
          </select>
        </div>

        <div className="relative">
          <Clock className="absolute left-3 top-3 text-slate-400" size={18} />
          <select 
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 appearance-none text-sm font-medium"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            <option value="">Todos Status</option>
            <option value="nova">Nova</option>
            <option value="em_andamento">Em Andamento</option>
            <option value="concluida">Concluída</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </div>

        <div className="relative">
          <AlertCircle className="absolute left-3 top-3 text-slate-400" size={18} />
          <select 
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 appearance-none text-sm font-medium"
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value)}
          >
            <option value="">Prioridades</option>
            <option value="alta">Alta</option>
            <option value="media">Média</option>
            <option value="baixa">Baixa</option>
          </select>
        </div>
      </div>
      
      <div className="bg-white shadow-sm rounded-3xl overflow-hidden border border-slate-100">
        {/* Mobile Layout (Cards) */}
        <div className="block lg:hidden divide-y divide-slate-100">
          {sortedDemands.length === 0 ? (
            <div className="p-10 text-center text-slate-500">Nenhuma demanda encontrada.</div>
          ) : (
            sortedDemands.map((demand: Demand) => (
              <div 
                key={demand.demandas.id} 
                className={`p-5 space-y-3 active:bg-slate-50 ${demand.demandas.precisaRetorno ? 'bg-red-50/50' : ''}`}
                onClick={() => handleOpenDemand(demand.demandas.id)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900">{demand.municipes.name}</h4>
                      {demand.demandas.precisaRetorno && (
                        <span className="bg-red-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase">Equipe</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{formatPhone(demand.municipes.phone)}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border uppercase ${getStatusColor(demand.demandas.status)}`}>
                    {demand.demandas.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="px-2.5 py-1 bg-slate-100 rounded-lg text-[10px] font-bold text-slate-600 uppercase flex items-center gap-1">
                    <Tag size={10} /> {demand.demandas.categoria.replace('_', ' ')}
                  </span>
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase flex items-center gap-1 bg-slate-50 ${getPriorityColor(demand.demandas.prioridade)}`}>
                    <AlertCircle size={10} /> {demand.demandas.prioridade}
                  </span>
                  <span className="px-2.5 py-1 bg-slate-50 rounded-lg text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                    <Clock size={10} /> {new Date(demand.demandas.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Layout (Table) */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th 
                  className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer"
                  onClick={() => toggleSort('name')}
                >
                  <div className="flex items-center">Munícipe <SortIcon field="name" /></div>
                </th>
                <th 
                  className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer"
                  onClick={() => toggleSort('category')}
                >
                  <div className="flex items-center">Categoria <SortIcon field="category" /></div>
                </th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th 
                  className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer"
                  onClick={() => toggleSort('priority')}
                >
                  <div className="flex items-center">Prioridade <SortIcon field="priority" /></div>
                </th>
                <th 
                  className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer"
                  onClick={() => toggleSort('date')}
                >
                  <div className="flex items-center">Data <SortIcon field="date" /></div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedDemands.map((demand: Demand) => (
                <tr 
                  key={demand.demandas.id} 
                  className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${demand.demandas.precisaRetorno ? 'bg-red-50/40' : ''}`}
                  onClick={() => handleOpenDemand(demand.demandas.id)}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 font-bold text-slate-900">
                      {demand.municipes.name}
                      {demand.demandas.precisaRetorno && (
                        <span className="bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm">EQUIPE</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 font-medium">{formatPhone(demand.municipes.phone)}</div>
                  </td>
                  <td className="px-6 py-4 text-xs font-bold text-slate-600 capitalize">
                    {demand.demandas.categoria.replace('_', ' ')}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border uppercase ${getStatusColor(demand.demandas.status)}`}>
                      {demand.demandas.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${getPriorityColor(demand.demandas.prioridade)}`}>
                      {demand.demandas.prioridade}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs font-bold text-slate-400">
                    {new Date(demand.demandas.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs font-bold text-slate-500">
            Página <strong>{pagination.page}</strong> de <strong>{pagination.totalPages}</strong> ({pagination.total} demandas)
          </p>
          <div className="flex items-center gap-2">
            <button 
              disabled={pagination.page === 1 || loading}
              onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 disabled:opacity-30 hover:bg-slate-50 transition-all shadow-sm"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex gap-1">
              {[...Array(pagination.totalPages)].map((_, i) => i + 1).filter(p => Math.abs(p - pagination.page) <= 1 || p === 1 || p === pagination.totalPages).map((p, i, arr) => (
                <div key={p} className="flex items-center">
                  {i > 0 && arr[i-1] !== p - 1 && <span className="px-1 text-slate-400">...</span>}
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: p }))}
                    className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${
                      pagination.page === p ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {p}
                  </button>
                </div>
              ))}
            </div>
            <button 
              disabled={pagination.page === pagination.totalPages || loading}
              onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 disabled:opacity-30 hover:bg-slate-50 transition-all shadow-sm"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {selectedDemand && (        <DemandModal 
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

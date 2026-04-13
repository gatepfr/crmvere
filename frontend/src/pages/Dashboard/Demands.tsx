import { useEffect, useState, useMemo } from 'react';
import api from '../../api/client';
import DemandModal from '../../components/DemandModal';
import NewDemandModal from '../../components/NewDemandModal';
import { FileDown, Download, Loader2, ClipboardList, ArrowUpDown, ArrowUp, ArrowDown, Plus, AlertCircle, Search, Tag, Clock } from 'lucide-react';
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

type SortField = 'name' | 'date' | 'priority' | 'category';
type SortOrder = 'asc' | 'desc';

export default function Demands() {
  const [demands, setDemands] = useState<Demand[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDemand, setSelectedDemand] = useState<any>(null);
  const [isNewDemandModalOpen, setIsNewDemandModalOpen] = useState(false);
  const [filterByAttention, setFilterByAttention] = useState(false);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const fetchDemands = () => {
    api.get('/demands')
      .then(res => setDemands(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDemands();
  }, []);

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
    const cleaned = phone.replace(/\D/g, '');
    const finalNumber = cleaned.length > 11 ? cleaned.slice(-11) : cleaned;
    
    if (finalNumber.length === 11) {
      return `(${finalNumber.slice(0, 2)}) ${finalNumber.slice(2, 7)}-${finalNumber.slice(7)}`;
    } else if (finalNumber.length === 10) {
      return `(${finalNumber.slice(0, 2)}) ${finalNumber.slice(2, 6)}-${finalNumber.slice(6)}`;
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
    <div className="max-w-6xl mx-auto space-y-8">
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
      
      <div className="bg-white shadow-sm rounded-2xl overflow-hidden border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 min-w-[800px] md:min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => toggleSort('name')}
                >
                  <div className="flex items-center">Munícipe <SortIcon field="name" /></div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => toggleSort('category')}
                >
                  <div className="flex items-center">Categoria <SortIcon field="category" /></div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => toggleSort('priority')}
                >
                  <div className="flex items-center">Prioridade <SortIcon field="priority" /></div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => toggleSort('date')}
                >
                  <div className="flex items-center">Data <SortIcon field="date" /></div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedDemands.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                    Nenhuma demanda encontrada.
                  </td>
                </tr>
              ) : (
                sortedDemands.map((demand: Demand) => (
                  <tr 
                    key={demand.demandas.id} 
                    className={`transition-colors cursor-pointer ${
                      demand.demandas.precisaRetorno 
                        ? 'bg-red-50/80 hover:bg-red-100/80' 
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => handleOpenDemand(demand.demandas.id)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        {demand.municipes.name}
                        {demand.demandas.precisaRetorno && (
                          <span className="inline-flex items-center gap-1 bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded animate-pulse shadow-sm">
                            <AlertCircle size={10} />
                            EQUIPE
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 font-normal">{formatPhone(demand.municipes.phone)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                      {demand.demandas.categoria}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(demand.demandas.status)}`}>
                        {demand.demandas.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(demand.demandas.prioridade)}`}>
                        {demand.demandas.prioridade}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(demand.demandas.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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

import { useEffect, useState, useMemo } from 'react';
import api from '../../api/client';
import DemandModal from '../../components/DemandModal';
import { FileDown, Download, Loader2, ClipboardList, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Demand {
  demandas: {
    id: string;
    categoria: string;
    status: string;
    prioridade: string;
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

  const sortedDemands = useMemo(() => {
    const sorted = [...demands];
    sorted.sort((a, b) => {
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
  }, [demands, sortField, sortOrder]);

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

  const exportCSV = () => {
    const headers = ['Protocolo', 'Cidadao', 'Categoria', 'Prioridade', 'Status', 'Data'];
    const rows = sortedDemands.map(d => [
      `MUN-${new Date(d.demandas.createdAt).getFullYear()}-${d.demandas.id.slice(0, 5).toUpperCase()}`,
      d.municipes.name,
      d.demandas.categoria,
      d.demandas.prioridade,
      d.demandas.status,
      new Date(d.demandas.createdAt).toLocaleDateString('pt-BR')
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `demandas_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    const tableHeaders = [['Protocolo', 'Cidadao', 'Categoria', 'Status', 'Data']];
    const tableData = sortedDemands.map(d => [
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
        <span className="ml-2 text-gray-600 font-medium">Carregando demandas...</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center">
            <ClipboardList className="mr-3 h-8 w-8 text-blue-600" />
            Fila de Demandas
          </h1>
          <p className="text-slate-500 mt-1">Gerencie e responda as solicitações recebidas via WhatsApp.</p>
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
          <button 
            onClick={exportCSV}
            className="flex-1 md:flex-none flex items-center justify-center px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-all shadow-sm"
          >
            <Download className="mr-2 h-4 w-4" />
            CSV
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
      
      <div className="bg-white shadow-sm rounded-2xl overflow-hidden border border-slate-200">
        <table className="min-w-full divide-y divide-gray-200">
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
                  Nenhuma demanda recebida via WhatsApp ainda.
                </td>
              </tr>
            ) : (
              sortedDemands.map((demand) => (
                <tr 
                  key={demand.demandas.id} 
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => handleOpenDemand(demand.demandas.id)}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {demand.municipes.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                    {demand.demandas.categoria}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                      demand.demandas.status === 'nova' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      demand.demandas.status === 'em_andamento' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                      demand.demandas.status === 'concluida' ? 'bg-green-50 text-green-700 border-green-200' :
                      'bg-gray-50 text-gray-700 border-gray-200'
                    }`}>
                      {demand.demandas.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      demand.demandas.prioridade.toLowerCase() === 'alta' ? 'bg-red-50 text-red-700' :
                      demand.demandas.prioridade.toLowerCase() === 'urgente' ? 'bg-red-100 text-red-900 font-bold' :
                      demand.demandas.prioridade.toLowerCase() === 'media' ? 'bg-orange-50 text-orange-700' :
                      'bg-gray-50 text-gray-700'
                    }`}>
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

      {selectedDemand && (
        <DemandModal 
          demand={selectedDemand} 
          onClose={() => setSelectedDemand(null)} 
          onUpdate={fetchDemands} 
        />
      )}
    </div>
  );
}

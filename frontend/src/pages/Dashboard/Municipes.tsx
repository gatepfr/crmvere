import { useState, useEffect } from 'react';
import api from '../../api/client';
import { 
  Users, 
  Search, 
  MapPin, 
  Phone, 
  MessageCircle, 
  Loader2, 
  CheckSquare, 
  Square,
  Send,
  X,
  CheckCircle2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileDown,
  Star
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Municipe {
  id: string;
  name: string;
  phone: string;
  bairro: string | null;
  createdAt: string;
  demandCount: number;
}

export default function Municipes() {
  const [municipes, setMunicipes] = useState<Municipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBairro, setSelectedBairro] = useState('');
  const [onlyEngaged, setOnlyEngaged] = useState(false);
  const [selectedMunicipes, setSelectedSelectedMunicipes] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: 'name' | 'bairro' | 'createdAt' | 'demandCount'; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    loadMunicipes();
  }, []);

  const loadMunicipes = async () => {
    try {
      const res = await api.get('/demands/municipes/list');
      setMunicipes(res.data);
    } catch (err) {
      console.error('Erro ao carregar munícipes:', err);
    } finally {
      setLoading(false);
    }
  };

  const bairros = Array.from(new Set(municipes.map(m => m.bairro).filter(Boolean))) as string[];

  const handleSort = (key: 'name' | 'bairro' | 'createdAt' | 'demandCount') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredMunicipes = municipes
    .filter(m => {
      const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           m.phone.includes(searchTerm);
      const matchesBairro = !selectedBairro || m.bairro === selectedBairro;
      const matchesEngaged = !onlyEngaged || m.demandCount >= 5;
      return matchesSearch && matchesBairro && matchesEngaged;
    })
    .sort((a, b) => {
      const valA = a[sortConfig.key] || '';
      const valB = b[sortConfig.key] || '';
      
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

  const toggleSelect = (id: string) => {
    setSelectedSelectedMunicipes(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedMunicipes.length === filteredMunicipes.length) {
      setSelectedSelectedMunicipes([]);
    } else {
      setSelectedSelectedMunicipes(filteredMunicipes.map(m => m.id));
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastMessage.trim()) return;
    setSending(true);
    setSendProgress({ current: 0, total: selectedMunicipes.length });

    for (let i = 0; i < selectedMunicipes.length; i++) {
      const municipeId = selectedMunicipes[i];
      const municipe = municipes.find(m => m.id === municipeId);
      
      try {
        // We use a generic endpoint or need a way to find a demand ID for this municipe
        // To simplify, let's assume we need to send to the phone directly.
        // For now, we'll search for the latest demand of this municipe to use our existing route
        const demandsRes = await api.get('/demands');
        const latestDemand = demandsRes.data.find((d: any) => d.municipes.id === municipeId);
        
        if (latestDemand) {
          await api.post('/whatsapp/send', {
            demandId: latestDemand.demandas.id,
            message: broadcastMessage
          });
        }
      } catch (err) {
        console.error(`Erro ao enviar para ${municipe?.name}:`, err);
      }
      
      setSendProgress(prev => ({ ...prev, current: i + 1 }));
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setSending(false);
    setIsModalOpen(false);
    setBroadcastMessage('');
    setSelectedSelectedMunicipes([]);
    alert('Mensagens enviadas com sucesso!');
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '';
    // Remove 55 prefix if exists
    let raw = phone.startsWith('55') ? phone.slice(2) : phone;
    
    // If it's a mobile number missing the leading 9 (10 digits total)
    // and starting with a digit that indicates a mobile (usually 7, 8, 9 in Brazil)
    if (raw.length === 10 && ['7', '8', '9'].includes(raw[2])) {
      raw = raw.slice(0, 2) + '9' + raw.slice(2);
    }

    // Apply mask (DD) XXXXX-XXXX (11 digits) or (DD) XXXX-XXXX (10 digits)
    if (raw.length === 11) {
      return `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7)}`;
    }
    if (raw.length === 10) {
      return `(${raw.slice(0, 2)}) ${raw.slice(2, 6)}-${raw.slice(6)}`;
    }
    return raw;
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(18);
    doc.text('Relatório de Munícipes - CRM do Verê', 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 28);
    if (selectedBairro) {
      doc.text(`Filtro por Bairro: ${selectedBairro}`, 14, 34);
    }

    const tableData = filteredMunicipes.map(m => [
      m.name,
      formatPhone(m.phone),
      m.bairro || 'Não informado',
      new Date(m.createdAt).toLocaleDateString('pt-BR')
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['Nome', 'Telefone', 'Bairro', 'Data Cadastro']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [30, 41, 59] }, // slate-800
      styles: { fontSize: 9 }
    });

    doc.save(`municipes-${new Date().getTime()}.pdf`);
  };

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <Users className="text-blue-600" />
            Base de Munícipes
          </h1>
          <p className="text-slate-500 mt-1">Gerencie seus contatos e realize disparos segmentados por bairro.</p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={exportToPDF}
            className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            <FileDown size={20} className="text-slate-400" />
            Exportar PDF
          </button>

          {selectedMunicipes.length > 0 && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-green-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-500/20 flex items-center gap-2 animate-in zoom-in duration-200"
            >
              <MessageCircle size={20} />
              Enviar para {selectedMunicipes.length}
            </button>
          )}
        </div>
      </header>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="relative">
          <Search className="absolute left-3 top-3 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Buscar por nome ou telefone..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="relative">
          <MapPin className="absolute left-3 top-3 text-slate-400" size={18} />
          <select 
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 appearance-none font-medium"
            value={selectedBairro}
            onChange={e => setSelectedBairro(e.target.value)}
          >
            <option value="">Todos os Bairros</option>
            {bairros.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between gap-4">
          <button 
            onClick={() => setOnlyEngaged(!onlyEngaged)}
            className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 border ${
              onlyEngaged 
                ? 'bg-amber-100 border-amber-200 text-amber-700 shadow-sm' 
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Star size={16} className={onlyEngaged ? 'fill-amber-500' : ''} />
            Apenas Engajados (+5)
          </button>
          
          <button 
            onClick={toggleSelectAll}
            className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-2 whitespace-nowrap"
          >
            {selectedMunicipes.length === filteredMunicipes.length ? <CheckSquare size={18} /> : <Square size={18} />}
            {selectedMunicipes.length === filteredMunicipes.length ? 'Desmarcar' : 'Selecionar'}
          </button>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest w-10"></th>
              <th 
                className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-blue-600 transition-colors"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-2">
                  Nome
                  {sortConfig.key === 'name' ? (
                    sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                  ) : <ArrowUpDown size={14} className="opacity-30" />}
                </div>
              </th>
              <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Telefone</th>
              <th 
                className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-blue-600 transition-colors"
                onClick={() => handleSort('bairro')}
              >
                <div className="flex items-center gap-2">
                  Bairro
                  {sortConfig.key === 'bairro' ? (
                    sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                  ) : <ArrowUpDown size={14} className="opacity-30" />}
                </div>
              </th>
              <th 
                className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-blue-600 transition-colors"
                onClick={() => handleSort('demandCount')}
              >
                <div className="flex items-center gap-2">
                  Demandas
                  {sortConfig.key === 'demandCount' ? (
                    sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                  ) : <ArrowUpDown size={14} className="opacity-30" />}
                </div>
              </th>
              <th 
                className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-blue-600 transition-colors"
                onClick={() => handleSort('createdAt')}
              >
                <div className="flex items-center gap-2">
                  Data Cadastro
                  {sortConfig.key === 'createdAt' ? (
                    sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                  ) : <ArrowUpDown size={14} className="opacity-30" />}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredMunicipes.map(m => (
              <tr 
                key={m.id} 
                className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${selectedMunicipes.includes(m.id) ? 'bg-blue-50/30' : ''}`}
                onClick={() => toggleSelect(m.id)}
              >
                <td className="px-6 py-4">
                  {selectedMunicipes.includes(m.id) ? (
                    <CheckSquare size={20} className="text-blue-600" />
                  ) : (
                    <Square size={20} className="text-slate-300" />
                  )}
                </td>
                <td className="px-6 py-4 font-bold text-slate-900">{m.name}</td>
                <td className="px-6 py-4 text-slate-600 font-medium">
                  <div className="flex items-center gap-2">
                    <Phone size={14} className="text-slate-400" />
                    {formatPhone(m.phone)}
                  </div>
                </td>
                <td className="px-6 py-4">
                  {m.bairro ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                      {m.bairro}
                    </span>
                  ) : (
                    <span className="text-slate-400 italic text-xs">Não informado</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black shadow-sm ${
                    m.demandCount >= 5 
                      ? 'bg-amber-500 text-white' 
                      : m.demandCount >= 3 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-slate-200 text-slate-600'
                  }`}>
                    {m.demandCount >= 5 && <Star size={12} className="fill-white" />}
                    {m.demandCount} {m.demandCount === 1 ? 'Demanda' : 'Demandas'}
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-500 text-sm">
                  {new Date(m.createdAt).toLocaleDateString('pt-BR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredMunicipes.length === 0 && (
          <div className="p-20 text-center">
            <p className="text-slate-500 font-medium">Nenhum munícipe encontrado com esses filtros.</p>
          </div>
        )}
      </div>

      {/* Broadcast Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-900">Disparo Segmentado</h3>
              <button onClick={() => !sending && setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-sm text-blue-800">
                  Você está enviando uma mensagem para <strong>{selectedMunicipes.length}</strong> munícipes
                  {selectedBairro ? ` do bairro ` : ''} 
                  {selectedBairro && <strong className="text-blue-900">{selectedBairro}</strong>}.
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">Mensagem</label>
                <textarea 
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  rows={5}
                  placeholder="Olá! Gostaria de informar sobre as obras na nossa região..."
                  value={broadcastMessage}
                  onChange={e => setBroadcastMessage(e.target.value)}
                  disabled={sending}
                />
              </div>

              {sending && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-widest">
                    <span>Enviando mensagens...</span>
                    <span>{sendProgress.current} / {sendProgress.total}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-600 transition-all duration-300"
                      style={{ width: `${(sendProgress.current / sendProgress.total) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button 
                onClick={() => setIsModalOpen(false)}
                disabled={sending}
                className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSendBroadcast}
                disabled={sending || !broadcastMessage.trim()}
                className="bg-blue-600 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2"
              >
                {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                {sending ? 'Processando...' : 'Iniciar Disparo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

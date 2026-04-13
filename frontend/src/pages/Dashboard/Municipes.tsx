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
  Star,
  Edit2,
  Trash2,
  Save
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

  // Edit Modal State
  const [editingMunicipe, setEditingMunicipe] = useState<Municipe | null>(null);
  const [editForm, setEditForm] = useState({ name: '', phone: '', bairro: '' });
  const [displayEditPhone, setDisplayEditPhone] = useState('');
  const [saving, setSaving] = useState(false);

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
      const valA = (a[sortConfig.key] || '').toString().toLowerCase();
      const valB = (b[sortConfig.key] || '').toString().toLowerCase();
      
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
    let cleaned = phone.replace(/\D/g, '');
    
    // Remove Brazilian country code if present
    if (cleaned.length >= 12 && cleaned.startsWith('55')) {
      cleaned = cleaned.slice(2);
    }
    
    // Intelligent Fix: If it has 10 digits, it's missing the 9th digit. Add it.
    if (cleaned.length === 10) {
      cleaned = cleaned.slice(0, 2) + '9' + cleaned.slice(2);
    }
    
    // Final format (99) 99999-9999
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    
    return phone;
  };

  const applyEditPhoneMask = (value: string) => {
    const raw = value.replace(/\D/g, '');
    let masked = raw;
    if (raw.length > 2) masked = `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
    if (raw.length > 7) masked = `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7, 11)}`;
    setDisplayEditPhone(masked);
    
    // Alway store with 55 in DB for backend compatibility
    const dbNumber = raw.startsWith('55') ? raw : `55${raw}`;
    setEditForm(prev => ({ ...prev, phone: dbNumber }));
  };

  const handleEdit = (m: Municipe) => {
    setEditingMunicipe(m);
    setEditForm({
      name: m.name,
      phone: m.phone,
      bairro: m.bairro || ''
    });
    setDisplayEditPhone(formatPhone(m.phone));
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este munícipe? Esta ação não pode ser desfeita.')) return;
    try {
      await api.delete(`/demands/municipe/${id}`);
      setMunicipes(prev => prev.filter(m => m.id !== id));
      alert('Munícipe excluído com sucesso!');
    } catch (err) {
      alert('Falha ao excluir munícipe.');
    }
  };

  const handleSaveEdit = async () => {
    if (!editingMunicipe) return;
    setSaving(true);
    try {
      await api.patch(`/demands/municipe/${editingMunicipe.id}`, editForm);
      loadMunicipes();
      setEditingMunicipe(null);
      alert('Dados atualizados com sucesso!');
    } catch (err) {
      alert('Falha ao atualizar dados.');
    } finally {
      setSaving(false);
    }
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
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
      headStyles: { fillColor: [30, 41, 59] },
      styles: { fontSize: 9 }
    });

    doc.save(`municipes-${new Date().getTime()}.pdf`);
  };

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest rounded-full border border-blue-100">
              Base de Contatos
            </span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            Munícipes
          </h1>
          <p className="text-slate-500 mt-1 font-medium">Gerencie e segmente sua base de eleitores e apoiadores.</p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={exportToPDF}
            className="px-5 py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center gap-2 shadow-sm active:scale-95"
          >
            <FileDown size={18} className="text-slate-400" />
            Relatório PDF
          </button>

          {selectedMunicipes.length > 0 && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 flex items-center gap-2 animate-in zoom-in duration-300 active:scale-95"
            >
              <MessageCircle size={20} />
              Enviar para {selectedMunicipes.length}
            </button>
          )}
        </div>
      </header>

      {/* Stats Cards - New Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col gap-1">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total de Munícipes</span>
          <span className="text-3xl font-black text-slate-900">{municipes.length}</span>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col gap-1">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bairros Atendidos</span>
          <span className="text-3xl font-black text-blue-600">{bairros.length}</span>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col gap-1">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Altamente Engajados</span>
          <span className="text-3xl font-black text-amber-500">{municipes.filter(m => m.demandCount >= 5).length}</span>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col gap-1">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selecionados</span>
          <span className="text-3xl font-black text-indigo-600">{selectedMunicipes.length}</span>
        </div>
      </div>

      {/* Filters Bar - Refined */}
      <div className="bg-slate-900 rounded-[2.5rem] p-4 flex flex-col lg:flex-row items-center gap-4 shadow-2xl shadow-slate-900/20 border border-slate-800">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input 
            type="text"
            placeholder="Buscar por nome ou telefone..."
            className="w-full pl-12 pr-4 py-3.5 bg-slate-800/50 border border-slate-700 text-white rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-500 font-medium"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="relative flex-1 w-full">
          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <select 
            className="w-full pl-12 pr-10 py-3.5 bg-slate-800/50 border border-slate-700 text-white rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 appearance-none font-bold text-sm"
            value={selectedBairro}
            onChange={e => setSelectedBairro(e.target.value)}
          >
            <option value="">Todos os Bairros</option>
            {bairros.sort().map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto">
          <button 
            onClick={() => setOnlyEngaged(!onlyEngaged)}
            className={`flex-1 lg:flex-none px-6 py-3.5 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 border uppercase tracking-widest ${
              onlyEngaged 
                ? 'bg-amber-500 border-amber-400 text-white shadow-lg shadow-amber-500/20' 
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <Star size={14} className={onlyEngaged ? 'fill-white' : ''} />
            Engajados
          </button>
          
          <button 
            onClick={toggleSelectAll}
            className="px-6 py-3.5 bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-600/20 transition-all whitespace-nowrap"
          >
            {selectedMunicipes.length === filteredMunicipes.length ? 'Desmarcar Tudo' : 'Selecionar Tudo'}
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest w-10"></th>
                <th 
                  className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer group"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-2 group-hover:text-blue-600 transition-colors">
                    Nome Completo
                    {sortConfig.key === 'name' ? (
                      sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                    ) : <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-100" />}
                  </div>
                </th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Contato</th>
                <th 
                  className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer group"
                  onClick={() => handleSort('bairro')}
                >
                  <div className="flex items-center gap-2 group-hover:text-blue-600 transition-colors">
                    Bairro
                    {sortConfig.key === 'bairro' ? (
                      sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                    ) : <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-100" />}
                  </div>
                </th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Engajamento</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredMunicipes.map(m => (
                <tr 
                  key={m.id} 
                  className={`group transition-all duration-200 cursor-pointer ${selectedMunicipes.includes(m.id) ? 'bg-blue-50/40' : 'hover:bg-slate-50/80'}`}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('button')) return;
                    toggleSelect(m.id);
                  }}
                >
                  <td className="px-8 py-5">
                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                      selectedMunicipes.includes(m.id) 
                        ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30' 
                        : 'bg-white border-slate-200 group-hover:border-slate-300'
                    }`}>
                      {selectedMunicipes.includes(m.id) && <CheckCircle2 size={14} strokeWidth={3} />}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{m.name}</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                        Cadastrado em {new Date(m.createdAt).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-600 font-bold text-xs shadow-sm">
                      <Phone size={12} className="text-blue-500" />
                      {formatPhone(m.phone)}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    {m.bairro ? (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black bg-blue-50 text-blue-600 border border-blue-100 uppercase tracking-widest">
                        {m.bairro}
                      </span>
                    ) : (
                      <span className="text-slate-300 italic text-[10px] font-bold uppercase tracking-widest">Não informado</span>
                    )}
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex justify-center">
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black shadow-sm border ${
                        m.demandCount >= 5 
                          ? 'bg-amber-500 border-amber-400 text-white' 
                          : m.demandCount >= 3 
                            ? 'bg-blue-600 border-blue-500 text-white' 
                            : 'bg-white border-slate-200 text-slate-500'
                      }`}>
                        {m.demandCount >= 5 && <Star size={10} className="fill-white" />}
                        {m.demandCount} {m.demandCount === 1 ? 'DEMANDA' : 'DEMANDAS'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleEdit(m)}
                        className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-xl transition-all shadow-sm bg-white border border-slate-100"
                        title="Editar Munícipe"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(m.id)}
                        className="p-2.5 text-red-600 hover:bg-red-50 rounded-xl transition-all shadow-sm bg-white border border-slate-100"
                        title="Excluir Munícipe"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredMunicipes.length === 0 && (
          <div className="p-24 text-center">
            <div className="inline-flex p-6 rounded-[2.5rem] bg-slate-50 mb-4">
              <Users size={48} className="text-slate-200" />
            </div>
            <h3 className="text-lg font-black text-slate-900">Nenhum munícipe encontrado</h3>
            <p className="text-slate-500 font-medium max-w-xs mx-auto mt-2">Tente ajustar seus filtros ou busca para encontrar quem você procura.</p>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingMunicipe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-900">Editar Munícipe</h3>
              <button onClick={() => setEditingMunicipe(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            
            <div className="p-8 space-y-5">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Nome Completo</label>
                <input 
                  type="text"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-sm"
                  value={editForm.name}
                  onChange={e => setEditForm({...editForm, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">WhatsApp (Número)</label>
                <input 
                  type="text"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-sm"
                  value={displayEditPhone}
                  onChange={e => applyEditPhoneMask(e.target.value)}
                  placeholder="(43) 99999-9999"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Bairro</label>
                <input 
                  type="text"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-sm"
                  value={editForm.bairro}
                  onChange={e => setEditForm({...editForm, bairro: e.target.value})}
                />
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button 
                onClick={() => setEditingMunicipe(null)}
                className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveEdit}
                disabled={saving}
                className="bg-blue-600 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

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

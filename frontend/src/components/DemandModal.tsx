import api from '../api/client';
import { useState, useEffect } from 'react';
import { 
  X, 
  User, 
  Phone, 
  Tag, 
  AlertCircle, 
  MessageSquare, 
  CheckCircle2, 
  Clock, 
  Layout, 
  ChevronRight,
  Loader2,
  MapPin as MapIcon,
  Trash2
  } from 'lucide-react';

interface DemandModalProps {
  demand: any;
  onClose: () => void;
  onUpdate: () => void;
}

export default function DemandModal({ demand, onClose, onUpdate }: DemandModalProps) {
  const [status, setStatus] = useState(demand.demandas.status);
  const [municipe, setMunicipe] = useState({
    name: demand.municipes.name,
    phone: demand.municipes.phone,
    bairro: demand.municipes.bairro || ''
  });
  const [displayPhone, setDisplayPhone] = useState('');

  useEffect(() => {
    if (demand.municipes.phone) {
      // Remove o 55 inicial para exibir na máscara
      const raw = demand.municipes.phone.startsWith('55') ? demand.municipes.phone.slice(2) : demand.municipes.phone;
      applyPhoneMask(raw);
    }
  }, [demand.municipes.phone]);

  const applyPhoneMask = (value: string) => {
    const raw = value.replace(/\D/g, '').slice(0, 11);
    let masked = raw;
    if (raw.length > 2) masked = `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
    if (raw.length > 7) masked = `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7)}`;
    setDisplayPhone(masked);
    setMunicipe(prev => ({ ...prev, phone: raw ? `55${raw}` : '' }));
  };
  const [resumoIa, setResumoIa] = useState(demand.demandas.resumoIa);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingResumo, setIsEditingResumo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    // Load campaigns to allow moving to kanban
    api.get('/kanban/campaigns')
      .then(res => setCampaigns(res.data))
      .catch(err => console.error('Error loading campaigns', err));
  }, []);

  const handleUpdateMunicipe = async () => {
    setLoading(true);
    try {
      await api.patch(`/demands/municipe/${demand.municipes.id}`, municipe);
      setIsEditing(false);
      onUpdate();
      alert('Dados atualizados!');
    } catch (err) {
      alert('Falha ao atualizar dados do munícipe.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateResumo = async () => {
    setLoading(true);
    try {
      // We need a route to update demand summary, let's use a generic patch for demands
      await api.patch(`/demands/${demand.demandas.id}/status`, { resumoIa });
      setIsEditingResumo(false);
      onUpdate();
      alert('Resumo atualizado!');
    } catch (err) {
      alert('Falha ao atualizar resumo.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMunicipe = async () => {
    if (!confirm('Deseja realmente EXCLUIR este munícipe e TODAS as suas demandas? Esta ação é irreversível.')) return;
    setLoading(true);
    try {
      await api.delete(`/demands/municipe/${demand.municipes.id}`);
      onClose();
      onUpdate();
    } catch (err) {
      alert('Falha ao excluir munícipe.');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setLoading(true);
    try {
      await api.patch(`/demands/${demand.demandas.id}/status`, { status: newStatus });
      setStatus(newStatus);
      onUpdate();
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
      alert('Falha ao atualizar status.');
    } finally {
      setLoading(false);
    }
  };

  const moveToKanban = async (campaignId: string) => {
    setMoving(true);
    try {
      await api.post(`/kanban/campaigns/${campaignId}/leads`, {
        name: demand.municipes.name,
        phone: demand.municipes.phone,
        notes: `Demanda original: ${demand.demandas.resumoIa}`,
        municipeId: demand.municipes.id
      });
      alert('Convertido em Lead com sucesso!');
    } catch (err) {
      alert('Falha ao mover para Kanban.');
    } finally {
      setMoving(false);
    }
  };

  // Helper to format conversation and bold text
  const formatText = (text: string) => {
    if (!text) return '';
    
    return text.split('\n').map((line, lineIndex) => {
      let content: React.ReactNode = line;

      // Handle Bold markers **text**
      const parts = line.split(/(\*\*.*?\*\*)/g).map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="text-slate-900">{part.slice(2, -2)}</strong>;
        }
        return part;
      });
      content = parts;

      // Style based on who is speaking
      if (line.startsWith('Cidadão:') || line.startsWith('Munícipe:')) {
        return (
          <div key={lineIndex} className="mb-3 pb-2 border-b border-slate-100 last:border-0">
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 block mb-1">Solicitação do Cidadão</span>
            <div className="text-slate-900 font-semibold">{content}</div>
          </div>
        );
      }

      if (line.startsWith('AI:') || line.startsWith('Gabinete:') || line.startsWith('Resposta:')) {
        return (
          <div key={lineIndex} className="mb-3 pl-4 border-l-2 border-slate-200 py-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Resposta do Gabinete</span>
            <div className="text-slate-600 italic leading-relaxed">{content}</div>
          </div>
        );
      }

      return <div key={lineIndex} className="mb-2">{content}</div>;
    });
  };

  if (!demand) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Detalhes da Demanda</h3>
            <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mt-1">
              PROTOCOLO: MUN-{new Date(demand.demandas.createdAt).getFullYear()}-{demand.demandas.id.slice(0, 5).toUpperCase()}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {/* Munícipe Info */}
          <div className="p-6 bg-blue-50/50 rounded-2xl border border-blue-100">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                  <User size={24} />
                </div>
                <div>
                  <p className="text-xs text-blue-600 uppercase font-bold tracking-wider">Cidadão</p>
                  <h4 className="text-xl font-bold text-slate-900 leading-tight">
                    {isEditing ? (
                      <input 
                        className="bg-white border border-blue-200 rounded px-2 py-1 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                        value={municipe.name}
                        onChange={e => setMunicipe({...municipe, name: e.target.value})}
                      />
                    ) : municipe.name}
                  </h4>
                </div>
              </div>
              <div className="flex gap-2">
                {isEditing ? (
                  <button 
                    onClick={handleUpdateMunicipe}
                    className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all shadow-sm"
                    title="Salvar"
                  >
                    <CheckCircle2 size={16} />
                  </button>
                ) : (
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="p-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm"
                    title="Editar Dados"
                  >
                    <Layout size={16} />
                  </button>
                )}
                <button 
                  onClick={handleDeleteMunicipe}
                  className="p-2 bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 transition-all shadow-sm"
                  title="Excluir Munícipe"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center text-sm text-slate-600 font-medium">
                <Phone size={14} className="mr-2 text-slate-400" />
                {isEditing ? (
                  <input 
                    className="bg-white border border-blue-200 rounded px-2 py-1 text-xs focus:outline-none w-full"
                    value={displayPhone}
                    onChange={e => applyPhoneMask(e.target.value)}
                    placeholder="(43) 99999-9999"
                  />
                ) : displayPhone}
              </div>
              <div className="flex items-center text-sm text-slate-600 font-medium">
                <MapIcon size={14} className="mr-2 text-slate-400" />
                {isEditing ? (
                  <input 
                    className="bg-white border border-blue-200 rounded px-2 py-1 text-xs focus:outline-none w-full"
                    value={municipe.bairro}
                    onChange={e => setMunicipe({...municipe, bairro: e.target.value})}
                    placeholder="Bairro"
                  />
                ) : (municipe.bairro || 'Bairro não informado')}
              </div>
            </div>
          </div>

          {/* AI Summary / Resumo */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 text-slate-800 font-bold">
                <MessageSquare size={18} className="text-blue-600" />
                <h4>Resumo e Contexto</h4>
              </div>
              {isEditingResumo ? (
                <button onClick={handleUpdateResumo} className="text-xs font-black text-green-600 uppercase tracking-widest hover:text-green-700">Salvar Alterações</button>
              ) : (
                <button onClick={() => setIsEditingResumo(true)} className="text-xs font-black text-slate-400 uppercase tracking-widest hover:text-blue-600">Editar Resumo</button>
              )}
            </div>
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 text-slate-700 leading-relaxed min-h-[100px]">
              {isEditingResumo ? (
                <textarea 
                  className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  rows={6}
                  value={resumoIa}
                  onChange={e => setResumoIa(e.target.value)}
                />
              ) : (
                <div className="whitespace-pre-wrap font-medium">
                  {formatText(resumoIa)}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Categoria</p>
              <div className="flex items-center gap-2 text-slate-900 font-semibold">
                <Tag size={16} className="text-slate-400" />
                <span className="capitalize">{demand.demandas.categoria}</span>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Prioridade</p>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                demand.demandas.prioridade.toLowerCase() === 'alta' ? 'bg-red-100 text-red-700' :
                demand.demandas.prioridade.toLowerCase() === 'urgente' ? 'bg-red-600 text-white shadow-lg shadow-red-200' :
                demand.demandas.prioridade.toLowerCase() === 'media' ? 'bg-orange-100 text-orange-700' :
                'bg-slate-100 text-slate-700'
              }`}>
                <AlertCircle size={12} className="mr-1.5" />
                {demand.demandas.prioridade.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Kanban Actions */}
          {campaigns.length > 0 && (
            <div className="pt-6 border-t border-slate-100">
              <label className="block text-xs text-slate-500 uppercase font-bold tracking-wider mb-4">Mover para Campanha (Kanban)</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {campaigns.map(c => (
                  <button
                    key={c.id}
                    disabled={moving}
                    onClick={() => moveToKanban(c.id)}
                    className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group"
                  >
                    <div className="flex items-center gap-2">
                      <Layout size={16} className="text-slate-400 group-hover:text-blue-600" />
                      <span className="text-sm font-bold text-slate-700">{c.name}</span>
                    </div>
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-blue-600" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Status Control */}
          <div className="pt-6 border-t border-slate-100">
            <label className="block text-xs text-slate-500 uppercase font-bold tracking-wider mb-4">Atualizar Status</label>
            <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
              {[
                { id: 'nova', label: 'Nova', icon: Clock },
                { id: 'em_andamento', label: 'Em Aberto', icon: Loader2 },
                { id: 'concluida', label: 'Concluída', icon: CheckCircle2 }
              ].map((s) => (
                <button
                  key={s.id}
                  disabled={loading}
                  onClick={() => handleStatusChange(s.id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-xl transition-all ${
                    status === s.id
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                  } disabled:opacity-50`}
                >
                  <s.icon size={16} className={status === s.id ? 'animate-spin' : ''} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-8 py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold hover:bg-slate-100 transition-all active:scale-95"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

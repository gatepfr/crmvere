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
  Trash2,
  ClipboardList,
  ExternalLink,
  Plus
  } from 'lucide-react';

interface DemandModalProps {
  demand: any;
  onClose: () => void;
  onUpdate: () => void;
  onOpenCreateDemand?: (municipe: any) => void;
}

export default function DemandModal({ demand, onClose, onUpdate, onOpenCreateDemand }: DemandModalProps) {
  const [status, setStatus] = useState(demand.demandas.status);
  const [prioridade, setPrioridade] = useState(demand.demandas.prioridade);
  const [categoria, setCategoria] = useState(demand.demandas.categoria);
  const [municipe, setMunicipe] = useState({
    name: demand.municipes.name,
    phone: demand.municipes.phone,
    bairro: demand.municipes.bairro || '',
    id: demand.municipes.id
  });
  const [displayPhone, setDisplayPhone] = useState('');
  const [resumoIa, setResumoIa] = useState(demand.demandas.resumoIa || demand.demandas.descricao || '');
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingResumo, setIsEditingResumo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [manualMessage, setManualMessage] = useState('');
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [moving, setMoving] = useState(false);

  // Novos estados legislativos
  const [isLegislativo, setIsLegislativo] = useState(demand.demandas.isLegislativo);
  const [numeroIndicacao, setNumeroIndicacao] = useState(demand.demandas.numeroIndicacao || '');
  const [documentUrl, setDocumentUrl] = useState(demand.demandas.documentUrl || '');

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

  useEffect(() => {
    if (demand.municipes.phone) {
      setDisplayPhone(formatPhone(demand.municipes.phone));
    }
  }, [demand.municipes.phone]);

  const applyPhoneMask = (value: string) => {
    const raw = value.replace(/\D/g, '');
    let masked = raw;
    if (raw.length > 2) masked = `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
    if (raw.length > 7) masked = `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7, 11)}`;
    setDisplayPhone(masked);
    
    const dbNumber = raw.startsWith('55') ? raw : `55${raw}`;
    setMunicipe(prev => ({ ...prev, phone: dbNumber }));
  };

  const handleUpdateField = async (field: string, value: string) => {
    setLoading(true);
    try {
      await api.patch(`/demands/${demand.demandas.id}/status`, { [field]: value });
      if (field === 'status') setStatus(value);
      if (field === 'prioridade') setPrioridade(value);
      if (field === 'categoria') setCategoria(value);
      onUpdate();
    } catch (err) {
      console.error(`Erro ao atualizar ${field}:`, err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateLegislativo = async () => {
    setLoading(true);
    try {
      await api.patch(`/demands/${demand.demandas.id}/status`, { 
        isLegislativo, 
        numeroIndicacao, 
        documentUrl 
      });
      onUpdate();
      alert('Status legislativo atualizado!');
    } catch (err) {
      alert('Falha ao atualizar dados legislativos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api.get('/kanban/campaigns')
      .then(res => setCampaigns(res.data))
      .catch(err => console.error('Error loading campaigns', err));
  }, []);

  const handleSendMessage = async () => {
    if (!manualMessage.trim()) return;
    setSendingMessage(true);
    try {
      await api.post('/whatsapp/send', {
        demandId: demand.demandas.id,
        message: manualMessage
      });
      setResumoIa((prev: string) => `${prev}\n\nGabinete: ${manualMessage}`);
      setManualMessage('');
      onUpdate();
    } catch (err) {
      alert('Falha ao enviar mensagem pelo WhatsApp.');
    } finally {
      setSendingMessage(false);
    }
  };

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
    handleUpdateField('status', newStatus);
  };

  const moveToKanban = async (campaignId: string) => {
    setMoving(true);
    try {
      const payload = {
        name: demand.municipes.name,
        phone: demand.municipes.phone,
        notes: `Demanda original: ${resumoIa}`,
        municipeId: demand.municipes.id
      };
      await api.post(`/kanban/campaigns/${campaignId}/leads`, payload);
      alert('Convertido em Lead com sucesso!');
    } catch (err: any) {
      alert(`Falha ao mover para Kanban: ${err.message}`);
    } finally {
      setMoving(false);
    }
  };

  const formatText = (text: string) => {
    if (!text) return '';
    return text.split('\n').map((line, lineIndex) => {
      let content: React.ReactNode = line;
      const parts = line.split(/(\*\*.*?\*\*)/g).map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="text-slate-900">{part.slice(2, -2)}</strong>;
        }
        return part;
      });
      content = parts;
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
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Detalhes do Registro</h3>
            <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mt-1">
              CRM-PROTOCOLO-{new Date(demand.demandas.createdAt).getFullYear()}-{demand.demandas.id.slice(0, 5).toUpperCase()}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
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
                      <input className="bg-white border border-blue-200 rounded px-2 py-1 text-sm mt-1 w-full" value={municipe.name} onChange={e => setMunicipe({...municipe, name: e.target.value})} />
                    ) : municipe.name}
                  </h4>
                </div>
              </div>
              <div className="flex gap-2">
                {isEditing ? (
                  <button onClick={handleUpdateMunicipe} className="p-2 bg-green-600 text-white rounded-lg"><CheckCircle2 size={16} /></button>
                ) : (
                  <button onClick={() => setIsEditing(true)} className="p-2 bg-white border border-slate-200 rounded-lg"><Layout size={16} /></button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-sm text-slate-600 font-medium flex items-center">
                <Phone size={14} className="mr-2 text-slate-400" /> {displayPhone}
              </div>
              <div className="text-sm text-slate-600 font-medium flex items-center">
                <MapIcon size={14} className="mr-2 text-slate-400" /> {municipe.bairro || 'Não informado'}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center text-slate-800 font-bold">
              <div className="flex items-center gap-2">
                <MessageSquare size={18} className="text-blue-600" />
                <h4>Resumo e Histórico</h4>
              </div>
            </div>
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 text-slate-700 leading-relaxed min-h-[100px]">
              <div className="whitespace-pre-wrap font-medium">{formatText(resumoIa)}</div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
            <h4 className="text-slate-800 font-bold flex items-center gap-2">
              <ClipboardList size={18} className="text-emerald-600" />
              Ações de Gabinete
            </h4>
            <button 
              onClick={() => onOpenCreateDemand ? onOpenCreateDemand(demand.municipes) : handleUpdateLegislativo()}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all"
            >
              <Plus size={16} />
              Criar Demanda Oficial
            </button>
          </div>
          
          {isLegislativo && (
            <div className="p-6 bg-emerald-50/50 border border-emerald-100 rounded-2xl space-y-4">
              <h5 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">DADOS LEGISLATIVOS</h5>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Nº Indicação</label>
                  <input className="w-full bg-white border border-emerald-100 rounded-xl px-4 py-2 text-sm font-bold" value={numeroIndicacao} onChange={e => setNumeroIndicacao(e.target.value)} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Link PDF</label>
                  <input className="w-full bg-white border border-emerald-100 rounded-xl px-4 py-2 text-sm font-bold" value={documentUrl} onChange={e => setDocumentUrl(e.target.value)} />
                </div>
              </div>
              <button onClick={handleUpdateLegislativo} className="w-full py-2 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-md">ATUALIZAR INDICAÇÃO</button>
            </div>
          )}

          <div className="pt-6 border-t border-slate-100 space-y-4">
            <div className="flex items-center gap-2 text-slate-800 font-bold">
              <Phone size={18} className="text-green-600" />
              <h4>Responder WhatsApp</h4>
            </div>
            <div className="flex flex-col gap-3">
              <textarea className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-sm font-medium" rows={3} placeholder="Digite sua resposta direta..." value={manualMessage} onChange={e => setManualMessage(e.target.value)} />
              <div className="flex justify-end">
                <button disabled={sendingMessage || !manualMessage.trim()} onClick={handleSendMessage} className="bg-green-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 disabled:opacity-50">
                  {sendingMessage ? <Loader2 size={18} className="animate-spin" /> : <MessageSquare size={18} />}
                  Enviar Resposta
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-50 flex justify-end">
          <button onClick={onClose} className="px-8 py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold hover:bg-slate-100">Fechar</button>
        </div>
      </div>
    </div>
  );
}

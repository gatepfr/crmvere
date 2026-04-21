import api from '../api/client';
import { useState, useEffect } from 'react';
import { formatPhone } from '../utils/formatPhone';
import {
  X,
  User,
  Phone,
  Tag,
  AlertCircle,
  MessageSquare,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin as MapIcon,
  Trash2,
  Edit2,
  Plus,
  Star
} from 'lucide-react';

interface DemandModalProps {
  demand: any;
  onClose: () => void;
  onUpdate: () => void;
  onOpenCreateDemand?: (municipe: any) => void;
}

interface Category { id: string; name: string; color: string; }

const DEFAULT_CATEGORIES_FALLBACK = [
  { id: 'f1', name: 'SAÚDE', color: '#db2777' },
  { id: 'f2', name: 'INFRAESTRUTURA', color: '#2563eb' },
  { id: 'f3', name: 'SEGURANÇA', color: '#dc2626' },
  { id: 'f4', name: 'EDUCAÇÃO', color: '#7c3aed' },
  { id: 'f5', name: 'ESPORTE', color: '#059669' },
  { id: 'f7', name: 'ZELADORIA URBANA', color: '#ea580c' },
  { id: 'f8', name: 'MOBILIDADE E TRÂNSITO', color: '#ca8a04' },
  { id: 'f9', name: 'CAUSA ANIMAL', color: '#0d9488' },
  { id: 'f10', name: 'ASSISTÊNCIA SOCIAL', color: '#4f46e5' },
  { id: 'f11', name: 'MEIO AMBIENTE', color: '#16a34a' },
  { id: 'f12', name: 'HABITAÇÃO', color: '#b45309' },
  { id: 'f6', name: 'OUTRO', color: '#4b5563' }
];

export default function DemandModal({ demand, onClose, onUpdate, onOpenCreateDemand }: DemandModalProps) {
  const [status, setStatus] = useState(demand.demandas.status);
  const [prioridade, setPrioridade] = useState(demand.demandas.prioridade || 'media');
  const [categoria, setCategoria] = useState(demand.demandas.categoria || 'OUTRO');
  const [municipe, setMunicipe] = useState({
    name: demand.municipes.name,
    phone: demand.municipes.phone,
    bairro: demand.municipes.bairro || '',
    isLideranca: demand.municipes.isLideranca || false,
    id: demand.municipes.id
  });
  const [displayPhone, setDisplayPhone] = useState('');
  const [resumoIa, setResumoIa] = useState(demand.demandas.resumoIa || demand.demandas.descricao || '');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [manualMessage, setManualMessage] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);

  // Novos estados legislativos
  const [isLegislativo] = useState(demand.demandas.isLegislativo);
  const [numeroIndicacao] = useState(demand.demandas.numeroIndicacao || '');
  const [documentUrl] = useState(demand.demandas.documentUrl || '');

  const applyPhoneMask = (value: string) => {
    const raw = value.replace(/\D/g, '').slice(0, 11);
    let masked = raw;
    if (raw.length > 2) masked = `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
    if (raw.length > 7) masked = `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7, 11)}`;
    setDisplayPhone(masked);
    
    const dbNumber = raw.startsWith('55') ? raw : `55${raw}`;
    setMunicipe(prev => ({ ...prev, phone: dbNumber }));
  };

  useEffect(() => {
    if (demand.municipes.phone) {
      const formatted = formatPhone(demand.municipes.phone);
      setDisplayPhone(formatted);
    }
    // Carrega categorias com fallback
    api.get('/demands/categories')
      .then(res => setCategories(res.data.length > 0 ? res.data : DEFAULT_CATEGORIES_FALLBACK))
      .catch(() => setCategories(DEFAULT_CATEGORIES_FALLBACK));
  }, [demand.municipes.phone, demand.demandas.id]);

  const handleUpdateField = async (field: string, value: string) => {
    setLoading(true);
    try {
      const isAtendimento = !!demand.atendimentoId || demand.demandas.status === 'nova';
      const endpoint = isAtendimento 
        ? `/demands/atendimentos/${demand.demandas.id}`
        : `/demands/${demand.demandas.id}/status`;

      await api.patch(endpoint, { [field]: value });
      
      if (field === 'status') setStatus(value);
      if (field === 'prioridade') setPrioridade(value);
      if (field === 'categoria') setCategoria(value);
      onUpdate();
    } catch (err: any) {
      console.error(`Erro ao atualizar ${field}:`, err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMunicipe = async (forceUpdate?: Partial<typeof municipe>) => {
    setLoading(true);
    const dataToSave = forceUpdate ? { ...municipe, ...forceUpdate } : municipe;
    try {
      await api.patch(`/demands/municipe/${municipe.id}`, dataToSave);
      setIsEditing(false);
      onUpdate();
      if (forceUpdate?.isLideranca !== undefined) {
        setMunicipe(prev => ({ ...prev, isLideranca: !!forceUpdate.isLideranca }));
        alert(`Status de liderança atualizado!`);
      } else {
        alert('Dados do cidadão atualizados!');
      }
    } catch (err) {
      alert('Falha ao atualizar dados.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMunicipe = async () => {
    if (!confirm('Deseja realmente EXCLUIR este munícipe e TODAS as suas demandas? Esta ação é irreversível.')) return;
    setLoading(true);
    try {
      await api.delete(`/demands/municipe/${municipe.id}`);
      onClose();
      onUpdate();
    } catch (err) {
      alert('Falha ao excluir munícipe.');
    } finally {
      setLoading(false);
    }
  };

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
      alert('Resposta enviada!');
    } catch (err) {
      alert('Falha ao enviar mensagem pelo WhatsApp.');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleUpdateLegislativo = async () => {
    setLoading(true);
    try {
      await api.patch(`/demands/${demand.demandas.id}/status`, { isLegislativo, numeroIndicacao, documentUrl });
      onUpdate();
      alert('Dados legislativos salvos!');
    } catch (err) {
      alert('Falha ao salvar indicação.');
    } finally {
      setLoading(false);
    }
  };

  const formatText = (text: string) => {
    if (!text) return '';
    return text.split('\n').map((line, idx) => <div key={idx} className="mb-2">{line}</div>);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* HEADER */}
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Gerenciar Atendimento</h3>
            <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-1">ID: {demand.demandas.id.slice(0, 8)}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={20} className="text-slate-500" /></button>
        </div>

        <div className="p-8 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
          
          {/* SEÇÃO CIDADÃO */}
          <div className="p-6 bg-blue-50/50 rounded-2xl border border-blue-100 relative group">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-white shadow-lg ${municipe.isLideranca ? 'bg-amber-500' : 'bg-blue-600'}`}>
                  {municipe.isLideranca ? <Star size={24} fill="currentColor" /> : <User size={24} />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] text-blue-600 font-black uppercase tracking-widest">Munícipe</p>
                    {municipe.isLideranca && <span className="bg-amber-100 text-amber-700 text-[8px] font-black px-1.5 py-0.5 rounded uppercase">Liderança</span>}
                  </div>
                  {isEditing ? (
                    <input 
                      className="mt-1 px-3 py-1 bg-white border border-blue-200 rounded-lg text-sm font-bold w-full outline-none focus:ring-2 focus:ring-blue-500"
                      value={municipe.name}
                      onChange={e => setMunicipe({...municipe, name: e.target.value})}
                    />
                  ) : (
                    <h4 className="text-lg font-bold text-slate-900">{municipe.name}</h4>
                  )}
                </div>
              </div>
              
              <div className="flex gap-2">
                {isEditing ? (
                  <button onClick={() => handleUpdateMunicipe()} className="p-2 bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700 transition-all"><CheckCircle2 size={16} /></button>
                ) : (
                  <>
                    <button onClick={() => setIsEditing(true)} className="p-2 bg-white border border-slate-200 text-slate-400 rounded-lg hover:text-blue-600 hover:border-blue-300 transition-all shadow-sm" title="Editar"><Edit2 size={16} /></button>
                    <button onClick={handleDeleteMunicipe} className="p-2 bg-white border border-slate-200 text-slate-400 rounded-lg hover:text-red-600 hover:border-red-300 transition-all shadow-sm" title="Excluir"><Trash2 size={16} /></button>
                  </>
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">WhatsApp</label>
                {isEditing ? (
                  <input className="w-full px-3 py-2 bg-white border border-blue-100 rounded-xl text-sm font-bold outline-none" value={displayPhone} onChange={e => applyPhoneMask(e.target.value)} />
                ) : (
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-600"><Phone size={14} className="text-blue-400" /> {displayPhone}</div>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Bairro</label>
                {isEditing ? (
                  <input className="w-full px-3 py-2 bg-white border border-blue-100 rounded-xl text-sm font-bold outline-none" value={municipe.bairro} onChange={e => setMunicipe({...municipe, bairro: e.target.value})} />
                ) : (
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-600"><MapIcon size={14} className="text-blue-400" /> {municipe.bairro || 'Não informado'}</div>
                )}
              </div>
            </div>

            {/* ATALHO LIDERANÇA */}
            <div className="mt-4 pt-4 border-t border-blue-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star size={16} className={municipe.isLideranca ? 'text-amber-500' : 'text-slate-300'} fill={municipe.isLideranca ? "currentColor" : "none"} />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cidadão Influente / Liderança</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={municipe.isLideranca}
                  onChange={e => handleUpdateMunicipe({ isLideranca: e.target.checked })}
                />
                <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>
          </div>

          {/* TRIAGEM (DROPDOWNS) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</label>
              <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-blue-500 transition-all" value={status} onChange={e => handleUpdateField('status', e.target.value)}>
                <option value="nova">Em Aberto</option>
                <option value="concluida">Concluída</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoria</label>
              <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-blue-500 transition-all" value={categoria} onChange={e => handleUpdateField('categoria', e.target.value)}>
                <option value="">Selecione...</option>
                {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Prioridade</label>
              <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-blue-500 transition-all" value={prioridade} onChange={e => handleUpdateField('prioridade', e.target.value)}>
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
          </div>

          {/* HISTÓRICO */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><MessageSquare size={16} /> Resumo e Histórico</h4>
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 text-slate-700 leading-relaxed max-h-40 overflow-y-auto">
              <div className="text-sm font-medium">{formatText(resumoIa)}</div>
            </div>
          </div>

          {/* RESPONDER WHATSAPP */}
          <div className="pt-6 border-t border-slate-100 space-y-4">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Phone size={16} className="text-green-600" /> Enviar Resposta WhatsApp</h4>
            <textarea className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-sm font-bold outline-none focus:border-green-500 transition-all" rows={3} placeholder="Digite sua resposta aqui..." value={manualMessage} onChange={e => setManualMessage(e.target.value)} />
            <button disabled={sendingMessage || !manualMessage.trim()} onClick={handleSendMessage} className="w-full bg-green-600 text-white py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-green-100 hover:bg-green-700 flex items-center justify-center gap-2 transition-all">
              {sendingMessage ? <Loader2 size={18} className="animate-spin" /> : <MessageSquare size={18} />}
              ENVIAR AGORA
            </button>
          </div>

        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button onClick={onClose} className="px-10 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all shadow-sm">Fechar</button>
        </div>
      </div>
    </div>
  );
}

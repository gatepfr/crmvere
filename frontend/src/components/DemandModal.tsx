import api from '../api/client';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { formatPhone } from '../utils/formatPhone';
import {
  User,
  Phone,
  MessageSquare,
  CheckCircle2,
  Loader2,
  MapPin as MapIcon,
  Trash2,
  Edit2,
  Star
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';

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

export default function DemandModal({ demand, onClose, onUpdate }: DemandModalProps) {
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
    if (demand.municipes.phone) setDisplayPhone(formatPhone(demand.municipes.phone));
    api.get('/demands/categories')
      .then(res => {
        const data: Category[] = res.data.length > 0 ? res.data : DEFAULT_CATEGORIES_FALLBACK;
        const sorted = [...data].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
        setCategories(sorted);
        const match = sorted.find(c => c.name.toUpperCase() === (demand.demandas.categoria || '').toUpperCase());
        if (match) setCategoria(match.name);
      })
      .catch(() => {
        const sorted = [...DEFAULT_CATEGORIES_FALLBACK].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
        setCategories(sorted);
        const match = sorted.find(c => c.name.toUpperCase() === (demand.demandas.categoria || '').toUpperCase());
        if (match) setCategoria(match.name);
      });
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
    } catch { console.error(`Erro ao atualizar ${field}`); }
    finally { setLoading(false); }
  };

  const handleUpdateMunicipe = async (forceUpdate?: Partial<typeof municipe>) => {
    setLoading(true);
    const dataToSave = forceUpdate ? { ...municipe, ...forceUpdate } : municipe;
    try {
      await api.patch(`/demands/municipes/${municipe.id}`, dataToSave);
      setIsEditing(false);
      onUpdate();
      if (forceUpdate?.isLideranca !== undefined) {
        setMunicipe(prev => ({ ...prev, isLideranca: !!forceUpdate.isLideranca }));
        toast.success('Status de liderança atualizado!');
      } else {
        toast.success('Dados do cidadão atualizados!');
      }
    } catch { toast.error('Falha ao atualizar dados.'); }
    finally { setLoading(false); }
  };

  const handleDeleteMunicipe = async () => {
    if (!confirm('Deseja realmente EXCLUIR este munícipe e TODAS as suas demandas? Esta ação é irreversível.')) return;
    setLoading(true);
    try {
      await api.delete(`/demands/municipes/${municipe.id}`);
      onClose(); onUpdate();
    } catch { toast.error('Falha ao excluir munícipe.'); }
    finally { setLoading(false); }
  };

  const handleSendMessage = async () => {
    if (!manualMessage.trim()) return;
    setSendingMessage(true);
    try {
      const payload = demand.atendimentoId
        ? { atendimentoId: demand.atendimentoId, message: manualMessage }
        : { demandId: demand.demandas.id, message: manualMessage };
      await api.post('/whatsapp/send', payload);
      setResumoIa((prev: string) => `${prev}\n\nGabinete: ${manualMessage}`);
      setManualMessage('');
      onUpdate();
      toast.success('Resposta enviada!');
    } catch { toast.error('Falha ao enviar mensagem pelo WhatsApp.'); }
    finally { setSendingMessage(false); }
  };

  const formatText = (text: string) => {
    if (!text) return '';
    return text.split('\n').map((line, idx) => <div key={idx} className="mb-2">{line}</div>);
  };

  const selectCls = "w-full px-4 py-3 bg-muted border border-input rounded-xl text-sm font-bold outline-none focus:bg-background focus:border-primary transition-all text-foreground";

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl p-0 max-h-[90vh] flex flex-col gap-0">
        <DialogHeader className="px-8 py-6 border-b border-border bg-muted/30 shrink-0">
          <DialogTitle>Gerenciar Atendimento</DialogTitle>
          <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">ID: {demand.demandas.id.slice(0, 8)}</p>
        </DialogHeader>

        <div className="flex-1 p-8 space-y-6 overflow-y-auto">

          {/* SEÇÃO CIDADÃO */}
          <div className="p-6 bg-primary/5 rounded-2xl border border-primary/20 relative group">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-white shadow-lg ${municipe.isLideranca ? 'bg-amber-500' : 'bg-primary'}`}>
                  {municipe.isLideranca ? <Star size={24} fill="currentColor" /> : <User size={24} />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] text-primary font-black uppercase tracking-widest">Munícipe</p>
                    {municipe.isLideranca && <span className="bg-amber-100 text-amber-700 text-[8px] font-black px-1.5 py-0.5 rounded uppercase">Liderança</span>}
                  </div>
                  {isEditing ? (
                    <input
                      className="mt-1 px-3 py-1 bg-background border border-border rounded-lg text-sm font-bold w-full outline-none focus:ring-2 focus:ring-ring text-foreground"
                      value={municipe.name}
                      onChange={e => setMunicipe({ ...municipe, name: e.target.value })}
                    />
                  ) : (
                    <div className="flex items-center gap-2 mt-0.5">
                      <h4 className="text-lg font-bold text-foreground">{municipe.name}</h4>
                      {demand.municipes.demandCount > 0 && (
                        <span className="bg-primary text-primary-foreground text-[10px] font-black px-2 py-0.5 rounded-full">
                          {demand.municipes.demandCount}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {isEditing ? (
                  <button onClick={() => handleUpdateMunicipe()} className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all"><CheckCircle2 size={16} /></button>
                ) : (
                  <>
                    <button onClick={() => setIsEditing(true)} className="p-2 bg-background border border-border text-muted-foreground rounded-lg hover:text-primary hover:border-primary/50 transition-all shadow-sm"><Edit2 size={16} /></button>
                    <button onClick={handleDeleteMunicipe} className="p-2 bg-background border border-border text-muted-foreground rounded-lg hover:text-destructive hover:border-destructive/50 transition-all shadow-sm"><Trash2 size={16} /></button>
                  </>
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">WhatsApp</label>
                {isEditing ? (
                  <input className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm font-bold outline-none text-foreground" value={displayPhone} onChange={e => applyPhoneMask(e.target.value)} />
                ) : (
                  <div className="flex items-center gap-2 text-sm font-bold text-foreground whitespace-nowrap"><Phone size={14} className="text-primary shrink-0" /> {displayPhone}</div>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Bairro</label>
                {isEditing ? (
                  <input className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm font-bold outline-none text-foreground" value={municipe.bairro} onChange={e => setMunicipe({ ...municipe, bairro: e.target.value })} />
                ) : (
                  <div className="flex items-center gap-2 text-sm font-bold text-foreground"><MapIcon size={14} className="text-primary" /> {municipe.bairro || 'Não informado'}</div>
                )}
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-primary/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star size={16} className={municipe.isLideranca ? 'text-amber-500' : 'text-muted-foreground/30'} fill={municipe.isLideranca ? 'currentColor' : 'none'} />
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Cidadão Influente / Liderança</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={municipe.isLideranca} onChange={e => handleUpdateMunicipe({ isLideranca: e.target.checked })} />
                <div className="w-9 h-5 bg-muted rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>
          </div>

          {/* TRIAGEM */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Status</label>
              <select className={selectCls} value={status} onChange={e => handleUpdateField('status', e.target.value)}>
                <option value="nova">Em Aberto</option>
                <option value="concluida">Concluída</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Categoria</label>
              <select className={selectCls} value={categoria} onChange={e => handleUpdateField('categoria', e.target.value)}>
                <option value="">Selecione...</option>
                {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Prioridade</label>
              <select className={selectCls} value={prioridade} onChange={e => handleUpdateField('prioridade', e.target.value)}>
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
          </div>

          {/* HISTÓRICO */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2"><MessageSquare size={16} /> Resumo e Histórico</h4>
            <div className="p-5 bg-muted rounded-2xl border border-border text-foreground leading-relaxed max-h-40 overflow-y-auto">
              <div className="text-sm font-medium">{formatText(resumoIa)}</div>
            </div>
          </div>

          {/* RESPONDER WHATSAPP */}
          <div className="pt-6 border-t border-border space-y-4">
            <h4 className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <Phone size={16} className="text-emerald-600" /> Enviar Resposta WhatsApp
            </h4>
            <textarea
              className="w-full bg-background border border-input rounded-2xl p-4 text-sm font-medium outline-none focus:border-emerald-500 transition-all text-foreground"
              rows={3}
              placeholder="Digite sua resposta aqui..."
              value={manualMessage}
              onChange={e => setManualMessage(e.target.value)}
            />
            <button
              disabled={sendingMessage || !manualMessage.trim()}
              onClick={handleSendMessage}
              className="w-full bg-emerald-600 text-white py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg hover:bg-emerald-700 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {sendingMessage ? <Loader2 size={18} className="animate-spin" /> : <MessageSquare size={18} />}
              ENVIAR AGORA
            </button>
          </div>
        </div>

        <div className="p-6 bg-muted/30 border-t border-border flex justify-end shrink-0">
          <Button variant="outline" onClick={onClose} className="px-10 font-black text-xs uppercase tracking-widest">Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

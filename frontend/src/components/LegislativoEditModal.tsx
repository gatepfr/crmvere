import api from '../api/client';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { formatPhone } from '../utils/formatPhone';
import {
  User,
  Phone,
  Tag,
  MapPin as MapIcon,
  CheckCircle2,
  Loader2,
  Edit2,
  FileText,
  Calendar,
  Users,
  MessageSquare,
  Send,
  Clock
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface LegislativoEditModalProps {
  demand: any;
  onClose: () => void;
  onUpdate: () => void;
}

interface Category { id: string; name: string; color: string; }
interface TeamMember { id: string; email: string; role: string; }
interface TimelineItem {
  id: string;
  type: string;
  content: string;
  userId: string;
  userEmail: string;
  action?: string;
  oldValue?: string;
  newValue?: string;
  createdAt: string;
}

const DEFAULT_CATEGORIES = [
  { id: 'f1', name: 'ASSISTÊNCIA SOCIAL', color: '#4f46e5' },
  { id: 'f2', name: 'CAUSA ANIMAL', color: '#0d9488' },
  { id: 'f3', name: 'EDUCAÇÃO', color: '#7c3aed' },
  { id: 'f4', name: 'ESPORTE', color: '#059669' },
  { id: 'f5', name: 'HABITAÇÃO', color: '#b45309' },
  { id: 'f6', name: 'INFRAESTRUTURA', color: '#2563eb' },
  { id: 'f7', name: 'MEIO AMBIENTE', color: '#16a34a' },
  { id: 'f8', name: 'MOBILIDADE E TRÂNSITO', color: '#ca8a04' },
  { id: 'f9', name: 'OUTRO', color: '#4b5563' },
  { id: 'f10', name: 'SAÚDE', color: '#db2777' },
  { id: 'f11', name: 'SEGURANÇA', color: '#dc2626' },
  { id: 'f12', name: 'ZELADORIA URBANA', color: '#ea580c' },
];

type Tab = 'detalhes' | 'atribuicao' | 'timeline';

export default function LegislativoEditModal({ demand, onClose, onUpdate }: LegislativoEditModalProps) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('detalhes');
  const [categories, setCategories] = useState<Category[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);

  const [municipe, setMunicipe] = useState({
    id: demand.municipes.id,
    name: demand.municipes.name,
    phone: demand.municipes.phone,
    bairro: demand.municipes.bairro || ''
  });
  const [displayPhone, setDisplayPhone] = useState('');
  const [categoria, setCategoria] = useState(demand.demandas.categoria || 'OUTRO');
  const [descricao, setDescricao] = useState(demand.demandas.descricao || '');
  const [assignedToId, setAssignedToId] = useState<string>(demand.demandas.assignedToId || '');
  const [dueDate, setDueDate] = useState<string>(
    demand.demandas.dueDate ? new Date(demand.demandas.dueDate).toISOString().split('T')[0] : ''
  );

  useEffect(() => {
    if (demand.municipes.phone) setDisplayPhone(formatPhone(demand.municipes.phone));
    api.get('/demands/categories')
      .then(res => {
        const data: Category[] = res.data.length > 0 ? res.data : DEFAULT_CATEGORIES;
        const sorted = [...data].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
        setCategories(sorted);
        const saved = demand.demandas.categoria || '';
        const match = sorted.find(c => c.name.toUpperCase() === saved.toUpperCase());
        if (match) setCategoria(match.name);
      })
      .catch(() => {
        const sorted = DEFAULT_CATEGORIES;
        setCategories(sorted);
        const saved = demand.demandas.categoria || '';
        const match = sorted.find(c => c.name.toUpperCase() === saved.toUpperCase());
        if (match) setCategoria(match.name);
      });
    api.get('/team')
      .then(res => setTeamMembers(res.data || []))
      .catch(() => {});
  }, [demand]);

  useEffect(() => {
    if (activeTab === 'timeline') loadTimeline();
  }, [activeTab]);

  const loadTimeline = async () => {
    setTimelineLoading(true);
    try {
      const res = await api.get(`/demands/${demand.demandas.id}/timeline`);
      setTimeline(res.data);
    } catch {
      setTimeline([]);
    } finally { setTimelineLoading(false); }
  };

  const applyPhoneMask = (value: string) => {
    const raw = value.replace(/\D/g, '').slice(0, 11);
    let masked = raw;
    if (raw.length > 2) masked = `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
    if (raw.length > 7) masked = `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7, 11)}`;
    setDisplayPhone(masked);
    const dbNumber = raw.startsWith('55') ? raw : `55${raw}`;
    setMunicipe(prev => ({ ...prev, phone: dbNumber }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.patch(`/demands/municipes/${municipe.id}`, {
        name: municipe.name, phone: municipe.phone, bairro: municipe.bairro
      });
      await api.patch(`/demands/${demand.demandas.id}/status`, {
        categoria, resumoIa: descricao,
        dueDate: dueDate || null
      });
      await api.patch(`/demands/${demand.demandas.id}/assign`, {
        userId: assignedToId || null
      });
      onUpdate();
      onClose();
    } catch {
      toast.error('Erro ao salvar as alterações.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendComment = async () => {
    if (!comment.trim()) return;
    setSendingComment(true);
    try {
      await api.post(`/demands/${demand.demandas.id}/comments`, { comment });
      setComment('');
      loadTimeline();
    } catch { toast.error('Erro ao enviar comentário.'); }
    finally { setSendingComment(false); }
  };

  const formatActivity = (item: TimelineItem) => {
    if (item.type === 'comment') return item.content;
    const labels: Record<string, string> = {
      assigned: 'Atribuído',
      status_changed: 'Status alterado',
      commented: 'Comentou'
    };
    return `${labels[item.action || ''] || item.action}: ${item.oldValue || '—'} → ${item.newValue || '—'}`;
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'detalhes', label: 'Detalhes' },
    { id: 'atribuicao', label: 'Atribuição' },
    { id: 'timeline', label: 'Timeline' },
  ];

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        showCloseButton={false}
        className="max-w-lg p-0 gap-0 overflow-hidden rounded-3xl"
      >
        <DialogHeader className="px-6 py-5 border-b border-border bg-muted/30 flex-row items-center justify-between space-y-0">
          <div>
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <Edit2 size={18} className="text-blue-600" />
              Editar Demanda
            </DialogTitle>
            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-1">
              {demand.municipes.name}
            </p>
          </div>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b border-border bg-background">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 py-3 text-[11px] font-black uppercase tracking-widest transition-all border-b-2 ${
                activeTab === t.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto bg-background">

          {activeTab === 'detalhes' && (
            <>
              <div className="space-y-4 p-5 bg-blue-50/30 dark:bg-blue-950/20 rounded-2xl border border-blue-100 dark:border-blue-900/40">
                <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                  <User size={14} /> Dados do Cidadão
                </h4>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Nome Completo</label>
                  <div className="relative">
                    <User size={14} className="absolute left-3 top-3 text-muted-foreground" />
                    <input
                      className="w-full pl-9 pr-4 py-2.5 bg-background border border-blue-100 dark:border-blue-900/40 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 text-foreground"
                      value={municipe.name}
                      onChange={e => setMunicipe({ ...municipe, name: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">WhatsApp</label>
                    <div className="relative">
                      <Phone size={14} className="absolute left-3 top-3 text-muted-foreground" />
                      <input
                        className="w-full pl-9 pr-4 py-2.5 bg-background border border-blue-100 dark:border-blue-900/40 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 text-foreground"
                        value={displayPhone}
                        onChange={e => applyPhoneMask(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Bairro</label>
                    <div className="relative">
                      <MapIcon size={14} className="absolute left-3 top-3 text-muted-foreground" />
                      <input
                        className="w-full pl-9 pr-4 py-2.5 bg-background border border-blue-100 dark:border-blue-900/40 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 text-foreground"
                        value={municipe.bairro}
                        onChange={e => setMunicipe({ ...municipe, bairro: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <FileText size={14} /> Detalhes do Assunto
                </h4>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Categoria</label>
                  <div className="relative">
                    <Tag size={14} className="absolute left-3 top-3.5 text-muted-foreground" />
                    <select
                      className="w-full pl-9 pr-4 py-3 bg-muted border border-border rounded-xl text-sm font-bold outline-none focus:bg-background focus:border-blue-500 appearance-none text-foreground"
                      value={categoria}
                      onChange={e => setCategoria(e.target.value)}
                    >
                      {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Descrição</label>
                  <textarea
                    className="w-full bg-muted border border-border rounded-2xl p-4 text-sm font-bold outline-none focus:bg-background focus:border-blue-500 min-h-[120px] text-foreground"
                    value={descricao}
                    onChange={e => setDescricao(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {activeTab === 'atribuicao' && (
            <div className="space-y-5">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1 flex items-center gap-1">
                  <Users size={12} /> Atribuir a
                </label>
                <select
                  className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-sm font-bold outline-none focus:bg-background focus:border-blue-500 appearance-none text-foreground"
                  value={assignedToId}
                  onChange={e => setAssignedToId(e.target.value)}
                >
                  <option value="">— Sem responsável —</option>
                  {teamMembers.map(m => (
                    <option key={m.id} value={m.id}>{m.email} ({m.role})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1 flex items-center gap-1">
                  <Calendar size={12} /> Prazo
                </label>
                <div className="relative">
                  <Clock size={14} className="absolute left-3 top-3 text-muted-foreground" />
                  <input
                    type="date"
                    className="w-full pl-9 pr-4 py-2.5 bg-muted border border-border rounded-xl text-sm font-bold outline-none focus:bg-background focus:border-blue-500 text-foreground"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="space-y-4">
              {timelineLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-blue-500" size={24} /></div>
              ) : timeline.length === 0 ? (
                <p className="text-center text-muted-foreground/50 font-black text-xs uppercase py-8">Nenhum registro ainda</p>
              ) : (
                <div className="space-y-3">
                  {timeline.map(item => (
                    <div key={item.id} className={`flex gap-3 ${item.type === 'comment' ? '' : 'opacity-70'}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5 ${
                        item.type === 'comment' ? 'bg-blue-100 dark:bg-blue-950 text-blue-600' : 'bg-muted text-muted-foreground'
                      }`}>
                        {item.userEmail?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-black text-muted-foreground">{item.userEmail?.split('@')[0] || 'Sistema'}</span>
                          <span className="text-[9px] text-muted-foreground/50">{new Date(item.createdAt).toLocaleString('pt-BR')}</span>
                        </div>
                        <p className={`text-sm leading-relaxed ${item.type === 'comment' ? 'text-foreground bg-muted rounded-xl px-3 py-2' : 'text-muted-foreground text-xs'}`}>
                          {formatActivity(item)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-2 border-t border-border">
                <div className="relative flex-1">
                  <MessageSquare size={14} className="absolute left-3 top-3 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Adicionar comentário..."
                    className="w-full pl-9 pr-4 py-2.5 bg-muted border border-border rounded-xl text-sm font-bold outline-none focus:bg-background focus:border-blue-500 text-foreground"
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendComment()}
                  />
                </div>
                <button
                  onClick={handleSendComment}
                  disabled={sendingComment || !comment.trim()}
                  className="px-4 py-2.5 bg-blue-600 text-white rounded-xl font-black text-xs disabled:opacity-40 flex items-center gap-1"
                >
                  {sendingComment ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-muted/50 border-t border-border flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-background border border-border text-foreground rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-muted transition-all"
          >
            Cancelar
          </button>
          {activeTab !== 'timeline' && (
            <button
              disabled={loading}
              onClick={handleSave}
              className="flex-1 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-100 dark:shadow-blue-950/50 hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              Salvar Alterações
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect } from 'react';
import api from '../api/client';
import { Loader2, ChevronRight, ChevronLeft, Send, Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type SegmentType = 'todos' | 'bairro' | 'lideranca' | 'aniversariantes' | 'categoria_demanda' | 'indicacao';
type SendMode = 'agora' | 'agendar';

interface PreviewData {
  total: number;
  sample: { name: string; phone: string }[];
}

const SEGMENT_OPTIONS: { value: SegmentType; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'bairro', label: 'Bairro' },
  { value: 'lideranca', label: 'Lideranças' },
  { value: 'aniversariantes', label: 'Aniversariantes do Mês' },
  { value: 'categoria_demanda', label: 'Categoria de Demanda' },
  { value: 'indicacao', label: 'Indicações Legislativas' },
];

export default function BroadcastModal({ isOpen, onClose, onSuccess }: Props) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [segmentType, setSegmentType] = useState<SegmentType>('todos');
  const [segmentValue, setSegmentValue] = useState('');
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [sendMode, setSendMode] = useState<SendMode>('agora');
  const [scheduledFor, setScheduledFor] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [segmentOptions, setSegmentOptions] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    if (segmentType !== 'bairro' && segmentType !== 'categoria_demanda') {
      setSegmentOptions([]);
      return;
    }
    api.get(`/broadcasts/segment-values?segmentType=${segmentType}`)
      .then(res => setSegmentOptions(res.data as string[]))
      .catch(() => setSegmentOptions([]));
  }, [isOpen, segmentType]);

  const reset = () => {
    setStep(1); setName(''); setMessage(''); setMediaUrl('');
    setSegmentType('todos'); setSegmentValue(''); setPreview(null);
    setSendMode('agora'); setScheduledFor(''); setError('');
  };

  const handleClose = () => { reset(); onClose(); };

  const goStep1to2 = () => {
    if (!name.trim()) { setError('Nome do disparo é obrigatório.'); return; }
    if (!message.trim()) { setError('Mensagem é obrigatória.'); return; }
    setError(''); setStep(2);
  };

  const goStep2to3 = async () => {
    setError(''); setLoading(true);
    try {
      const params = new URLSearchParams({ segmentType });
      if (segmentValue.trim()) params.append('segmentValue', segmentValue.trim());
      const res = await api.get(`/broadcasts/preview-segment?${params}`);
      setPreview(res.data as PreviewData);
      setStep(3);
    } catch { setError('Erro ao carregar pré-visualização.'); }
    finally { setLoading(false); }
  };

  const handleSend = async () => {
    setError(''); setLoading(true);
    try {
      const createBody: Record<string, string> = { name: name.trim(), message: message.trim(), segmentType };
      if (mediaUrl.trim()) createBody.mediaUrl = mediaUrl.trim();
      if (segmentValue.trim()) createBody.segmentValue = segmentValue.trim();
      const res = await api.post('/broadcasts', createBody);
      const created = res.data as { id: string };
      const sendBody: Record<string, string> = {};
      if (sendMode === 'agendar' && scheduledFor) sendBody.scheduledFor = new Date(scheduledFor).toISOString();
      await api.post(`/broadcasts/${created.id}/send`, sendBody);
      onSuccess();
      handleClose();
    } catch { setError('Erro ao enviar disparo. Tente novamente.'); }
    finally { setLoading(false); }
  };

  const needsSegmentValue = segmentType === 'bairro' || segmentType === 'categoria_demanda';
  const stepLabels = ['Mensagem', 'Segmento', 'Preview', 'Confirmar'];
  const inputCls = "w-full px-4 py-2.5 border border-input rounded-xl text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-xl p-0 flex flex-col max-h-[90vh] gap-0">
        <DialogHeader className="p-6 border-b border-border shrink-0">
          <DialogTitle>Novo Disparo em Massa</DialogTitle>
          <div className="flex items-center gap-1 mt-2">
            {stepLabels.map((label, i) => (
              <div key={label} className="flex items-center gap-1">
                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                  step === i + 1 ? 'bg-primary text-primary-foreground'
                  : step > i + 1 ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-muted text-muted-foreground'
                }`}>
                  <span>{i + 1}</span>
                  <span className="hidden sm:inline">{label}</span>
                </div>
                {i < 3 && <div className="w-4 h-px bg-border" />}
              </div>
            ))}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-sm text-destructive font-medium">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5">Nome do Disparo *</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Convite Audiência Pública" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5">Mensagem *</label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value.slice(0, 4000))}
                  placeholder="Digite a mensagem que será enviada..."
                  rows={6}
                  className={`${inputCls} resize-none`}
                />
                <div className="flex items-center justify-between mt-1">
                  <p className="text-[11px] text-muted-foreground">
                    Use <code className="bg-muted px-1 py-0.5 rounded font-mono text-foreground">{'{nome}'}</code> para inserir o nome de cada pessoa
                  </p>
                  <p className="text-[10px] text-muted-foreground font-medium">{message.length}/4000</p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5">
                  URL de Imagem <span className="text-muted-foreground font-normal normal-case">(opcional)</span>
                </label>
                <input type="url" value={mediaUrl} onChange={e => setMediaUrl(e.target.value)} placeholder="https://... (jpg, png, mp4, pdf...)" className={inputCls} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">Selecione o Segmento</label>
                <div className="space-y-2">
                  {SEGMENT_OPTIONS.map(opt => (
                    <label key={opt.value} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      segmentType === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:border-border/80'
                    }`}>
                      <input type="radio" name="segment" value={opt.value} checked={segmentType === opt.value}
                        onChange={() => { setSegmentType(opt.value); setSegmentValue(''); }} className="accent-primary" />
                      <span className={`text-sm font-bold ${segmentType === opt.value ? 'text-primary' : 'text-foreground'}`}>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              {needsSegmentValue && (
                <div>
                  <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5">
                    {segmentType === 'bairro' ? 'Bairro' : 'Categoria da Demanda'}
                  </label>
                  {segmentOptions.length > 0 ? (
                    <select value={segmentValue} onChange={e => setSegmentValue(e.target.value)} className={inputCls}>
                      <option value="">Selecione...</option>
                      {segmentOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : (
                    <input type="text" value={segmentValue} onChange={e => setSegmentValue(e.target.value)}
                      placeholder={segmentType === 'bairro' ? 'Ex: Centro' : 'Ex: Saúde'} className={inputCls} />
                  )}
                </div>
              )}
            </div>
          )}

          {step === 3 && preview && (
            <div className="space-y-4">
              <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 text-center">
                <p className="text-3xl font-black text-primary">{preview.total}</p>
                <p className="text-sm font-bold text-primary/80 mt-1">munícipes serão atingidos</p>
              </div>
              {preview.sample.length > 0 && (
                <div>
                  <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">Amostra de destinatários</p>
                  <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
                    {preview.sample.slice(0, 20).map((s, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-black text-muted-foreground shrink-0">
                          {s.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-foreground truncate">{s.name}</p>
                          <p className="text-xs text-muted-foreground">{s.phone}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Escolha quando o disparo será enviado:</p>
              <div className="space-y-2">
                {(['agora', 'agendar'] as SendMode[]).map((mode) => (
                  <label key={mode} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    sendMode === mode ? 'border-primary bg-primary/5' : 'border-border hover:border-border/80'
                  }`}>
                    <input type="radio" name="sendMode" value={mode} checked={sendMode === mode}
                      onChange={() => setSendMode(mode)} className="accent-primary" />
                    {mode === 'agora' ? <Send size={16} className={sendMode === 'agora' ? 'text-primary' : 'text-muted-foreground'} /> : <Clock size={16} className={sendMode === 'agendar' ? 'text-primary' : 'text-muted-foreground'} />}
                    <span className={`text-sm font-bold ${sendMode === mode ? 'text-primary' : 'text-foreground'}`}>
                      {mode === 'agora' ? 'Enviar Agora' : 'Agendar'}
                    </span>
                  </label>
                ))}
              </div>
              {sendMode === 'agendar' && (
                <div>
                  <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5">Data e Hora</label>
                  <input type="datetime-local" value={scheduledFor} onChange={e => setScheduledFor(e.target.value)} className={inputCls} />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-6 border-t border-border shrink-0">
          {step > 1 ? (
            <Button variant="outline" onClick={() => setStep(s => s - 1)} disabled={loading}>
              <ChevronLeft size={16} /> Voltar
            </Button>
          ) : <div />}

          {step === 1 && <Button onClick={goStep1to2} disabled={loading}>{loading ? <Loader2 size={16} className="animate-spin" /> : <ChevronRight size={16} />} Próximo</Button>}
          {step === 2 && <Button onClick={goStep2to3} disabled={loading}>{loading ? <Loader2 size={16} className="animate-spin" /> : <ChevronRight size={16} />} Pré-visualizar</Button>}
          {step === 3 && <Button onClick={() => setStep(4)}><ChevronRight size={16} /> Continuar</Button>}
          {step === 4 && (
            <Button onClick={handleSend} disabled={loading || (sendMode === 'agendar' && !scheduledFor)}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Confirmar e Enviar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

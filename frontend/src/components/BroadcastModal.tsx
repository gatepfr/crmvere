import { useState } from 'react';
import api from '../api/client';
import { X, Loader2, ChevronRight, ChevronLeft, Send, Clock } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type SegmentType = 'todos' | 'bairro' | 'lideranca' | 'aniversariantes' | 'categoria_demanda';
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
];

export default function BroadcastModal({ isOpen, onClose, onSuccess }: Props) {
  const [step, setStep] = useState(1);

  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');

  const [segmentType, setSegmentType] = useState<SegmentType>('todos');
  const [segmentValue, setSegmentValue] = useState('');

  const [broadcastId, setBroadcastId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);

  const [sendMode, setSendMode] = useState<SendMode>('agora');
  const [scheduledFor, setScheduledFor] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const reset = () => {
    setStep(1);
    setName('');
    setMessage('');
    setMediaUrl('');
    setSegmentType('todos');
    setSegmentValue('');
    setBroadcastId(null);
    setPreview(null);
    setSendMode('agora');
    setScheduledFor('');
    setError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const goStep1to2 = async () => {
    if (!name.trim()) { setError('Nome do disparo é obrigatório.'); return; }
    if (!message.trim()) { setError('Mensagem é obrigatória.'); return; }
    setError('');
    setLoading(true);
    try {
      const body: Record<string, string> = {
        name: name.trim(),
        message: message.trim(),
        segmentType,
      };
      if (mediaUrl.trim()) body.mediaUrl = mediaUrl.trim();
      if (segmentValue.trim()) body.segmentValue = segmentValue.trim();
      const res = await api.post('/broadcasts', body);
      const created = res.data as { id: string };
      setBroadcastId(created.id);
      setStep(2);
    } catch { setError('Erro ao criar disparo. Tente novamente.'); }
    finally { setLoading(false); }
  };

  const goStep2to3 = async () => {
    if (!broadcastId) return;
    setError('');
    setLoading(true);
    try {
      const body: Record<string, string> = { segmentType };
      if (segmentValue.trim()) body.segmentValue = segmentValue.trim();
      await api.patch(`/broadcasts/${broadcastId}`, body);
      const res = await api.get(`/broadcasts/${broadcastId}/preview`);
      setPreview(res.data as PreviewData);
      setStep(3);
    } catch { setError('Erro ao carregar pré-visualização.'); }
    finally { setLoading(false); }
  };

  const goStep3to4 = () => {
    setStep(4);
  };

  const handleSend = async () => {
    if (!broadcastId) return;
    setError('');
    setLoading(true);
    try {
      const body: Record<string, string> = {};
      if (sendMode === 'agendar' && scheduledFor) {
        body.scheduledFor = new Date(scheduledFor).toISOString();
      }
      await api.post(`/broadcasts/${broadcastId}/send`, body);
      onSuccess();
      handleClose();
    } catch { setError('Erro ao enviar disparo. Tente novamente.'); }
    finally { setLoading(false); }
  };

  const needsSegmentValue = segmentType === 'bairro' || segmentType === 'categoria_demanda';

  const stepLabels = ['Mensagem', 'Segmento', 'Preview', 'Confirmar'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl border border-slate-200 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-lg font-black text-slate-900">Novo Disparo em Massa</h2>
            <div className="flex items-center gap-1 mt-2">
              {stepLabels.map((label, i) => (
                <div key={label} className="flex items-center gap-1">
                  <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                    step === i + 1
                      ? 'bg-blue-600 text-white'
                      : step > i + 1
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-400'
                  }`}>
                    <span>{i + 1}</span>
                    <span className="hidden sm:inline">{label}</span>
                  </div>
                  {i < 3 && <div className="w-4 h-px bg-slate-200" />}
                </div>
              ))}
            </div>
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-700 transition-colors ml-4 shrink-0">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-1.5">
                  Nome do Disparo *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ex: Convite Audiência Pública"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-1.5">
                  Mensagem *
                </label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value.slice(0, 4000))}
                  placeholder="Digite a mensagem que será enviada..."
                  rows={6}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <p className="text-right text-[10px] text-slate-400 font-medium mt-1">
                  {message.length}/4000
                </p>
              </div>
              <div>
                <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-1.5">
                  URL de Mídia <span className="text-slate-400 font-normal normal-case">(opcional)</span>
                </label>
                <input
                  type="url"
                  value={mediaUrl}
                  onChange={e => setMediaUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-2">
                  Selecione o Segmento
                </label>
                <div className="space-y-2">
                  {SEGMENT_OPTIONS.map(opt => (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        segmentType === opt.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="segment"
                        value={opt.value}
                        checked={segmentType === opt.value}
                        onChange={() => { setSegmentType(opt.value); setSegmentValue(''); }}
                        className="accent-blue-600"
                      />
                      <span className={`text-sm font-bold ${segmentType === opt.value ? 'text-blue-700' : 'text-slate-700'}`}>
                        {opt.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              {needsSegmentValue && (
                <div>
                  <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-1.5">
                    {segmentType === 'bairro' ? 'Nome do Bairro' : 'Categoria da Demanda'}
                  </label>
                  <input
                    type="text"
                    value={segmentValue}
                    onChange={e => setSegmentValue(e.target.value)}
                    placeholder={segmentType === 'bairro' ? 'Ex: Centro' : 'Ex: Saúde'}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          )}

          {step === 3 && preview && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                <p className="text-3xl font-black text-blue-700">{preview.total}</p>
                <p className="text-sm font-bold text-blue-600 mt-1">munícipes serão atingidos</p>
              </div>
              {preview.sample.length > 0 && (
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                    Amostra de destinatários
                  </p>
                  <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                    {preview.sample.slice(0, 20).map((s, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black text-slate-500 shrink-0">
                          {s.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate">{s.name}</p>
                          <p className="text-xs text-slate-400">{s.phone}</p>
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
              <p className="text-sm text-slate-600">Escolha quando o disparo será enviado:</p>
              <div className="space-y-2">
                <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  sendMode === 'agora' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
                }`}>
                  <input
                    type="radio"
                    name="sendMode"
                    value="agora"
                    checked={sendMode === 'agora'}
                    onChange={() => setSendMode('agora')}
                    className="accent-blue-600"
                  />
                  <Send size={16} className={sendMode === 'agora' ? 'text-blue-600' : 'text-slate-400'} />
                  <span className={`text-sm font-bold ${sendMode === 'agora' ? 'text-blue-700' : 'text-slate-700'}`}>
                    Enviar Agora
                  </span>
                </label>
                <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  sendMode === 'agendar' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
                }`}>
                  <input
                    type="radio"
                    name="sendMode"
                    value="agendar"
                    checked={sendMode === 'agendar'}
                    onChange={() => setSendMode('agendar')}
                    className="accent-blue-600"
                  />
                  <Clock size={16} className={sendMode === 'agendar' ? 'text-blue-600' : 'text-slate-400'} />
                  <span className={`text-sm font-bold ${sendMode === 'agendar' ? 'text-blue-700' : 'text-slate-700'}`}>
                    Agendar
                  </span>
                </label>
              </div>
              {sendMode === 'agendar' && (
                <div>
                  <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-1.5">
                    Data e Hora
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledFor}
                    onChange={e => setScheduledFor(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-6 border-t border-slate-100 shrink-0">
          {step > 1 ? (
            <button
              onClick={() => setStep(s => s - 1)}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <ChevronLeft size={16} />
              Voltar
            </button>
          ) : (
            <div />
          )}

          {step === 1 && (
            <button
              onClick={goStep1to2}
              disabled={loading}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-black transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <ChevronRight size={16} />}
              Próximo
            </button>
          )}
          {step === 2 && (
            <button
              onClick={goStep2to3}
              disabled={loading}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-black transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <ChevronRight size={16} />}
              Pré-visualizar
            </button>
          )}
          {step === 3 && (
            <button
              onClick={goStep3to4}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-black transition-colors"
            >
              <ChevronRight size={16} />
              Continuar
            </button>
          )}
          {step === 4 && (
            <button
              onClick={handleSend}
              disabled={loading || (sendMode === 'agendar' && !scheduledFor)}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-black transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Confirmar e Enviar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

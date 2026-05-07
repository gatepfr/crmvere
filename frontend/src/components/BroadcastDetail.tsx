import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import api from '../api/client';
import { X, Loader2, AlertTriangle } from 'lucide-react';

interface BroadcastDetail {
  id: string;
  name: string;
  message: string;
  mediaUrl?: string | null;
  segmentType: 'bairro' | 'lideranca' | 'aniversariantes' | 'categoria_demanda' | 'todos';
  segmentValue?: string | null;
  status: 'rascunho' | 'enfileirado' | 'enviando' | 'concluido' | 'cancelado';
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  scheduledFor?: string | null;
  createdAt: string;
  pendentes: number;
  enviados: number;
  erros: number;
}

const SEGMENT_LABEL: Record<string, string> = {
  todos: 'Todos',
  bairro: 'Bairro',
  lideranca: 'Lideranças',
  aniversariantes: 'Aniversariantes do Mês',
  categoria_demanda: 'Categoria de Demanda',
};

const STATUS_LABEL: Record<string, string> = {
  rascunho: 'Rascunho',
  enfileirado: 'Enfileirado',
  enviando: 'Enviando...',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

interface Props {
  broadcastId: string;
  onClose: () => void;
}

export default function BroadcastDetail({ broadcastId, onClose }: Props) {
  const [data, setData] = useState<BroadcastDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/broadcasts/${broadcastId}`);
      setData(res.data as BroadcastDetail);
    } catch {}
    finally { setLoading(false); }
  }, [broadcastId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!data) return;
    if (data.status !== 'enviando' && data.status !== 'enfileirado') return;
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [data, load]);

  const handleCancel = async () => {
    if (!data) return;
    setCancelling(true);
    try {
      await api.post(`/broadcasts/${broadcastId}/cancel`);
      await load();
    } catch { toast.error('Erro ao cancelar disparo.'); }
    finally { setCancelling(false); }
  };

  const pct = data && data.totalRecipients > 0
    ? Math.round((data.sentCount / data.totalRecipients) * 100)
    : 0;

  const segmentLabel = data
    ? data.segmentValue
      ? `${SEGMENT_LABEL[data.segmentType]} — ${data.segmentValue}`
      : SEGMENT_LABEL[data.segmentType]
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-lg border border-border">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-lg font-black text-foreground truncate">
            {data ? data.name : 'Carregando...'}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors ml-4 shrink-0">
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-blue-600" size={32} />
          </div>
        ) : !data ? (
          <div className="p-6 text-center text-muted-foreground">Erro ao carregar dados.</div>
        ) : (
          <div className="p-6 space-y-5">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-muted-foreground">Progresso</span>
                <span className="text-sm font-black text-foreground">
                  {pct}% ({data.sentCount}/{data.totalRecipients})
                </span>
              </div>
              <progress
                value={data.sentCount}
                max={data.totalRecipients > 0 ? data.totalRecipients : 1}
                className="w-full h-3 rounded-full"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-muted-foreground">Status:</span>
              <span className={`text-sm font-black ${
                data.status === 'enviando' ? 'text-amber-600' :
                data.status === 'concluido' ? 'text-emerald-600' :
                data.status === 'cancelado' ? 'text-red-600' :
                data.status === 'enfileirado' ? 'text-blue-600' :
                'text-muted-foreground'
              }`}>
                {STATUS_LABEL[data.status]}
              </span>
              {(data.status === 'enviando' || data.status === 'enfileirado') && (
                <Loader2 size={14} className="animate-spin text-amber-500" />
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-emerald-700">{data.enviados}</p>
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mt-0.5">Enviados</p>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-blue-700">{data.pendentes}</p>
                <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mt-0.5">Pendentes</p>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-red-700">{data.erros}</p>
                <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mt-0.5">Erros</p>
              </div>
            </div>

            <div className="bg-muted rounded-xl border border-border p-4 space-y-2">
              <div>
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Mensagem</span>
                <p className="text-sm text-foreground mt-1 whitespace-pre-wrap line-clamp-4">{data.message}</p>
              </div>
              <div>
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Segmento</span>
                <p className="text-sm text-foreground mt-1">{segmentLabel}</p>
              </div>
              {data.scheduledFor && (
                <div>
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Agendado para</span>
                  <p className="text-sm text-foreground mt-1">
                    {new Date(data.scheduledFor).toLocaleString('pt-BR')}
                  </p>
                </div>
              )}
            </div>

            {(data.status === 'enviando' || data.status === 'enfileirado') && (
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-black hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                {cancelling ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
                Cancelar Disparo
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

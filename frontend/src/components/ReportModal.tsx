import { useState } from 'react';
import { X, FileText, Loader2, Calendar } from 'lucide-react';
import api from '../api/client';

type ReportType = 'mensal' | 'trimestral' | 'anual' | 'custom';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const TYPE_OPTIONS: { value: ReportType; label: string; desc: string }[] = [
  { value: 'mensal', label: 'Mensal', desc: 'Mês atual' },
  { value: 'trimestral', label: 'Trimestral', desc: 'Últimos 3 meses' },
  { value: 'anual', label: 'Anual', desc: `Janeiro a hoje (${new Date().getFullYear()})` },
  { value: 'custom', label: 'Personalizado', desc: 'Escolha o período' },
];

export default function ReportModal({ isOpen, onClose }: Props) {
  const [selectedType, setSelectedType] = useState<ReportType | null>(null);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    setSelectedType(null);
    setCustomStart('');
    setCustomEnd('');
    setError(null);
    onClose();
  };

  const handleGenerate = async () => {
    if (!selectedType) return;
    if (selectedType === 'custom' && (!customStart || !customEnd)) {
      setError('Informe o período inicial e final.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const body: Record<string, string> = { type: selectedType };
      if (selectedType === 'custom') {
        body.startDate = customStart;
        body.endDate = customEnd;
      }

      const res = await api.post('/reports/generate', body, {
        responseType: 'blob',
        timeout: 30000,
      });

      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      const today = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `prestacao-contas-${selectedType}-${today}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      handleClose();
    } catch {
      setError('Erro ao gerar relatório. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <FileText size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">Gerar Relatório</h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Prestação de Contas</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-500 font-medium">Selecione o período do relatório:</p>

          <div className="grid grid-cols-2 gap-3">
            {TYPE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setSelectedType(opt.value)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  selectedType === opt.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <p className={`font-black text-sm ${selectedType === opt.value ? 'text-blue-700' : 'text-slate-800'}`}>
                  {opt.label}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>

          {selectedType === 'custom' && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                <Calendar size={14} />
                Período personalizado
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Início</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={e => setCustomStart(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Fim</label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={e => setCustomEnd(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 font-medium bg-red-50 border border-red-100 rounded-lg px-4 py-3">
              {error}
            </p>
          )}
        </div>

        <div className="flex gap-3 p-6 pt-0">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-black text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleGenerate}
            disabled={!selectedType || loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-black rounded-xl transition-colors"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Gerando relatório...
              </>
            ) : (
              <>
                <FileText size={16} />
                Gerar PDF
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

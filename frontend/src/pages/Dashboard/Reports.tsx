import { useState } from 'react';
import { FileText, Download, CalendarDays, TrendingUp, BarChart3, FileCheck } from 'lucide-react';
import ReportModal from '../../components/ReportModal';

const FEATURES = [
  { icon: TrendingUp, label: 'KPIs do período', desc: 'Demandas totais, concluídas, munícipes atendidos' },
  { icon: BarChart3, label: 'Gráficos por bairro e categoria', desc: 'Visualização das demandas do território' },
  { icon: FileCheck, label: 'Indicações protocoladas', desc: 'Lista completa com números e status' },
  { icon: CalendarDays, label: 'Alcance de comunicação', desc: 'Mensagens enviadas via WhatsApp no período' },
];

export default function Reports() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <FileText className="text-blue-600" size={32} />
            Prestação de Contas
          </h1>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">
            Relatório PDF profissional do mandato
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-black rounded-xl transition-colors shadow-sm shadow-blue-200"
        >
          <Download size={16} />
          Gerar Relatório
        </button>
      </header>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
        <div className="max-w-2xl">
          <h2 className="text-lg font-black text-slate-800 mb-2">O que está incluído no relatório</h2>
          <p className="text-sm text-slate-500 mb-6">
            Gere um PDF completo com os dados do seu mandato para compartilhar com eleitores e redes sociais.
            Selecione o período (mensal, trimestral, anual ou personalizado) e baixe em segundos.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FEATURES.map(f => (
              <div key={f.label} className="flex gap-3 p-4 bg-slate-50 rounded-xl">
                <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                  <f.icon size={16} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-800">{f.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {(['mensal', 'trimestral', 'anual'] as const).map(type => {
          const labels: Record<string, { title: string; sub: string }> = {
            mensal: { title: 'Mensal', sub: 'Mês atual' },
            trimestral: { title: 'Trimestral', sub: 'Últimos 3 meses' },
            anual: { title: 'Anual', sub: `Janeiro–${new Date().getFullYear()}` },
          };
          return (
            <button
              key={type}
              onClick={() => setModalOpen(true)}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-left hover:border-blue-200 hover:shadow-md transition-all group"
            >
              <FileText size={24} className="text-slate-300 group-hover:text-blue-500 transition-colors mb-3" />
              <p className="font-black text-slate-800">{labels[type].title}</p>
              <p className="text-xs text-slate-400 mt-0.5">{labels[type].sub}</p>
            </button>
          );
        })}
      </div>

      <ReportModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

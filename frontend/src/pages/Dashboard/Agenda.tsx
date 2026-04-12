import { useState, useEffect } from 'react';
import api from '../../api/client';
import { Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Agenda() {
  const [calendarUrl, setCalendarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    api.get('/config/me')
      .then(res => setCalendarUrl(res.data.calendarUrl))
      .catch(err => console.error('Erro ao buscar agenda:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <Loader2 className="animate-spin text-blue-600 h-10 w-10" />
        <p className="mt-4 text-slate-600">Carregando agenda...</p>
      </div>
    );
  }

  if (!calendarUrl) {
    return (
      <div className="max-w-2xl mx-auto mt-20 p-8 bg-white rounded-2xl border border-slate-200 shadow-sm text-center">
        <div className="inline-flex items-center justify-center p-4 bg-amber-50 text-amber-600 rounded-full mb-6">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Agenda não configurada</h2>
        <p className="text-slate-600 mb-8">
          Para visualizar e gerenciar seus compromissos, você precisa configurar o link do seu Google Calendar.
        </p>
        <Link 
          to="/dashboard/cabinet"
          className="inline-flex items-center bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
        >
          Configurar Agora
        </Link>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-12rem)] flex flex-col space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Agenda do Vereador</h2>
          <p className="text-slate-500">Gerencie datas e horários de compromissos.</p>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => setShowHelp(!showHelp)}
            className="text-slate-500 hover:text-slate-700 text-sm font-medium px-3 py-2 rounded-lg border border-slate-200 bg-white transition-colors"
          >
            Como configurar?
          </button>
          <a 
            href={calendarUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-700 flex items-center text-sm font-semibold bg-blue-50 px-4 py-2 rounded-lg transition-colors"
          >
            <ExternalLink size={16} className="mr-2" />
            Abrir Google Agenda
          </a>
        </div>
      </header>

      {showHelp && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 mb-6 animate-in fade-in slide-in-from-top-4 duration-300">
          <h3 className="font-bold text-blue-900 mb-4 flex items-center">
            <AlertCircle size={20} className="mr-2" />
            Passo a Passo para Configurar a Agenda
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-blue-800">
            <div className="space-y-3">
              <p className="font-bold border-b border-blue-200 pb-1">Opção A: Apenas Visualização</p>
              <ol className="list-decimal ml-4 space-y-2">
                <li>No Google Agenda, vá em <strong>Configurações e Compartilhamento</strong> da sua agenda.</li>
                <li>Role até <strong>Integrar Agenda</strong>.</li>
                <li>Copie o link que aparece em <strong>URL pública para esta agenda</strong>.</li>
                <li>Cole este link nas configurações do Gabinete.</li>
              </ol>
            </div>
            <div className="space-y-3">
              <p className="font-bold border-b border-blue-200 pb-1">Opção B: Para Marcar Horários (Recomendado)</p>
              <ol className="list-decimal ml-4 space-y-2">
                <li>No Google Agenda, clique em <strong>Criar</strong> &gt; <strong>Agendamento</strong>.</li>
                <li>Configure seus horários e clique em <strong>Próximo</strong> até concluir.</li>
                <li>Clique em <strong>Compartilhar</strong> &gt; <strong>Página de agendamento</strong>.</li>
                <li>Copie o link e cole nas configurações do Gabinete.</li>
              </ol>
            </div>
          </div>
          <button 
            onClick={() => setShowHelp(false)}
            className="mt-4 text-xs font-bold text-blue-600 hover:underline"
          >
            Entendi, fechar instruções
          </button>
        </div>
      )}

      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">
        <iframe 
          src={calendarUrl} 
          style={{ border: 0 }} 
          width="100%" 
          height="100%" 
          frameBorder="0" 
          scrolling="no"
          title="Google Calendar"
          className="absolute inset-0"
        ></iframe>
      </div>
    </div>
  );
}

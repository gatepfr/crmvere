import { useState, useEffect } from 'react';
import api from '../../api/client';
import { Building2, Save, Loader2, Image as ImageIcon, MessageSquare } from 'lucide-react';

const DEFAULT_BIRTHDAY = "Olá {nome}, parabéns pelo seu aniversário! Desejamos muita saúde, paz e realizações. Conte sempre conosco! 🎂🎈";
const DEFAULT_LEGISLATIVE = "Olá {nome}! Gostaria de informar que sua solicitação sobre *{assunto}* virou a Indicação oficial nº *{numero}*. Você pode acompanhar por aqui: {link}";

export default function CabinetConfig() {
  const [config, setConfig] = useState({
    name: '',
    municipio: '',
    uf: '',
    partido: '',
    mandato: '',
    fotoUrl: '',
    calendarUrl: '',
    birthdayMessage: '',
    legislativeMessage: ''
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    api.get('/config/me')
      .then(res => {
        setConfig({
          name: res.data.name || '',
          municipio: res.data.municipio || '',
          uf: res.data.uf || '',
          partido: res.data.partido || '',
          mandato: res.data.mandato || '',
          fotoUrl: res.data.fotoUrl || '',
          calendarUrl: res.data.calendarUrl || '',
          birthdayMessage: res.data.birthdayMessage || DEFAULT_BIRTHDAY,
          legislativeMessage: res.data.legislativeMessage || DEFAULT_LEGISLATIVE
        });
      })
      .catch(err => console.error('Erro ao carregar dados do gabinete:', err))
      .finally(() => setFetching(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.patch('/config/update', config);
      alert('Dados do gabinete atualizados com sucesso!');
    } catch (err) {
      alert('Falha ao atualizar dados.');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Dados do Gabinete</h2>
        <p className="text-slate-500 mt-2">Configure as informações oficiais do vereador e do mandato.</p>
      </header>

      <form onSubmit={handleSave} className="space-y-8">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex items-center">
            <Building2 className="h-5 w-5 mr-2 text-blue-600" />
            <h3 className="font-bold text-slate-800 text-lg">Informações Gerais</h3>
          </div>
          
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700">Nome do Vereador</label>
              <input 
                type="text" 
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white"
                value={config.name}
                onChange={e => setConfig({...config, name: e.target.value})}
                placeholder="Ex: João da Silva"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">Município</label>
              <input 
                type="text" 
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white"
                value={config.municipio}
                onChange={e => setConfig({...config, municipio: e.target.value})}
                placeholder="Ex: São Paulo"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">UF (Estado)</label>
              <input 
                type="text" 
                maxLength={2}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white uppercase"
                value={config.uf}
                onChange={e => setConfig({...config, uf: e.target.value.toUpperCase()})}
                placeholder="Ex: SP"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">Partido Político</label>
              <input 
                type="text" 
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white"
                value={config.partido}
                onChange={e => setConfig({...config, partido: e.target.value})}
                placeholder="Ex: Partido ABC"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">Mandato (Legislatura)</label>
              <input 
                type="text" 
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white"
                value={config.mandato}
                onChange={e => setConfig({...config, mandato: e.target.value})}
                placeholder="Ex: 2025 - 2028"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700">Link de Incorporação da Agenda (Google Calendar)</label>
              <input 
                type="url" 
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white"
                value={config.calendarUrl}
                onChange={e => setConfig({...config, calendarUrl: e.target.value})}
                placeholder="https://calendar.google.com/calendar/embed?src=..."
              />
              <p className="text-xs text-slate-500">Cole o link 'src' do código de incorporação ou o link público da sua agenda.</p>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700">URL da Foto do Vereador</label>
              <div className="flex gap-4">
                <div className="flex-1">
                  <input 
                    type="url" 
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white"
                    value={config.fotoUrl}
                    onChange={e => setConfig({...config, fotoUrl: e.target.value})}
                    placeholder="https://exemplo.com/foto.jpg"
                  />
                </div>
                <div className="h-12 w-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {config.fotoUrl ? (
                    <img src={config.fotoUrl} alt="Preview" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-slate-400" />
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end">
            <button 
              type="submit"
              disabled={loading}
              className="bg-blue-600 text-white px-10 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all duration-200 disabled:opacity-50 flex items-center shadow-lg shadow-blue-500/20 active:scale-95"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-5 w-5" />
                  Salvar Dados do Gabinete
                </>
              )}
            </button>
          </div>
        </div>

        {/* Mensagens Automáticas */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex items-center">
            <MessageSquare className="h-5 w-5 mr-2 text-blue-600" />
            <h3 className="font-bold text-slate-800 text-lg">Mensagens Automáticas (WhatsApp)</h3>
          </div>

          <div className="p-8 space-y-6">
            <div className="p-5 bg-pink-50 rounded-2xl border border-pink-100 space-y-4">
              <div className="flex justify-between items-center">
                <label className="block text-sm font-black text-pink-700 uppercase tracking-tight">🎈 Mensagem de Aniversário</label>
                <span className="text-[10px] font-black text-pink-400 bg-white px-2 py-0.5 rounded border border-pink-100 uppercase">Variável: {'{nome}'}</span>
              </div>
              <textarea 
                className="w-full px-4 py-3 border border-pink-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none transition-all bg-white font-medium text-sm min-h-[100px]"
                value={config.birthdayMessage}
                onChange={e => setConfig({...config, birthdayMessage: e.target.value})}
                placeholder="Digite a mensagem de aniversário..."
              />
            </div>

            <div className="p-5 bg-blue-50 rounded-2xl border border-blue-100 space-y-4">
              <div className="flex justify-between items-center">
                <label className="block text-sm font-black text-blue-700 uppercase tracking-tight">📋 Mensagem de Indicação (Legislativo)</label>
                <span className="text-[10px] font-black text-blue-400 bg-white px-2 py-0.5 rounded border border-blue-100 uppercase flex gap-1">
                  <span>{'{nome}'}</span>
                  <span>{'{assunto}'}</span>
                  <span>{'{numero}'}</span>
                  <span>{'{link}'}</span>
                </span>
              </div>
              <textarea 
                className="w-full px-4 py-3 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white font-medium text-sm min-h-[100px]"
                value={config.legislativeMessage}
                onChange={e => setConfig({...config, legislativeMessage: e.target.value})}
                placeholder="Digite a mensagem de indicação..."
              />
            </div>
          </div>

          <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end">
            <button 
              type="submit"
              disabled={loading}
              className="bg-blue-600 text-white px-10 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all duration-200 disabled:opacity-50 flex items-center shadow-lg shadow-blue-500/20 active:scale-95"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-5 w-5" />
                  Salvar Configurações de Mensagens
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

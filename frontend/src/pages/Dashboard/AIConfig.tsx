import { useState, useEffect } from 'react';
import api from '../../api/client';

export default function AIConfig() {
  const [config, setConfig] = useState({ geminiApiKey: '', aiModel: '', systemPrompt: '' });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    api.get('/config/me')
      .then(res => {
        setConfig({
          geminiApiKey: res.data.geminiApiKey || '',
          aiModel: res.data.aiModel || 'gemini-1.5-flash',
          systemPrompt: res.data.systemPrompt || '',
        });
      })
      .catch(err => console.error('Erro ao carregar config:', err))
      .finally(() => setFetching(false));
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.patch('/config/update', config);
      alert('Configuração salva com sucesso!');
    } catch (err) {
      alert('Falha ao salvar configuração.');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <div>Carregando...</div>;

  return (
    <div className="max-w-4xl">
      <header className="mb-8">
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Configuração de IA</h2>
        <p className="text-slate-500">Ajuste o comportamento do Gemini no seu gabinete.</p>
      </header>
      
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Gemini API Key</label>
            <input 
              type="password" 
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={config.geminiApiKey}
              onChange={e => setConfig({...config, geminiApiKey: e.target.value})}
              placeholder="Sua chave da API do Google Gemini"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Modelo</label>
            <select 
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={config.aiModel}
              onChange={e => setConfig({...config, aiModel: e.target.value})}
            >
              <option value="gemini-1.5-flash">Gemini 1.5 Flash (Rápido e Eficiente)</option>
              <option value="gemini-1.5-pro">Gemini 1.5 Pro (Mais Inteligente)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Prompt de Sistema (Personalidade)</label>
          <textarea 
            rows={8}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            value={config.systemPrompt}
            onChange={e => setConfig({...config, systemPrompt: e.target.value})}
            placeholder="Ex: Você é o assistente virtual do Vereador João Silva. Sua função é receber demandas de cidadãos, ser cordial e extrair a categoria da solicitação (Saúde, Infraestrutura, etc)."
          />
          <p className="mt-2 text-xs text-slate-500">
            Dica: Descreva detalhadamente como a IA deve se comportar e quais informações ela deve priorizar.
          </p>
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button 
            onClick={handleSave}
            disabled={loading}
            className="bg-blue-600 text-white px-8 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Salvando...
              </>
            ) : 'Salvar Alterações'}
          </button>
        </div>
      </div>
    </div>
  );
}

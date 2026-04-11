import { useState, useEffect } from 'react';
import api from '../../api/client';
import { Bot, Cpu, Zap, Brain, CheckCircle2, Loader2 } from 'lucide-react';

const providers = [
  { id: 'gemini', name: 'Google Gemini', icon: Bot, color: 'text-blue-600', models: ['gemini-1.5-flash', 'gemini-1.5-pro'] },
  { id: 'openai', name: 'OpenAI (ChatGPT)', icon: Brain, color: 'text-green-600', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'] },
  { id: 'anthropic', name: 'Anthropic (Claude)', icon: Cpu, color: 'text-orange-600', models: ['claude-3-5-sonnet-20240620', 'claude-3-opus-20240229'] },
  { id: 'groq', name: 'Groq (Llama 3)', icon: Zap, color: 'text-purple-600', models: ['llama3-70b-8192', 'mixtral-8x7b-32768'] },
  { 
    id: 'openrouter', 
    name: 'OpenRouter', 
    icon: Zap, 
    color: 'text-indigo-600', 
    models: [
      'meta-llama/llama-3.1-405b-instruct',
      'meta-llama/llama-3.1-70b-instruct',
      'meta-llama/llama-3.1-8b-instruct',
      'google/gemini-pro-1.5',
      'google/gemini-flash-1.5',
      'anthropic/claude-3.5-sonnet',
      'openai/gpt-4o',
      'openai/gpt-4o-mini',
      'mistralai/mistral-7b-instruct',
      'qwen/qwen-2-72b-instruct'
    ] 
  },
  { id: 'custom', name: 'Custom IA', icon: Cpu, color: 'text-slate-600', models: [] },
];

export default function AIConfig() {
  const [config, setConfig] = useState({ 
    aiProvider: 'gemini', 
    aiApiKey: '', 
    aiModel: 'gemini-1.5-flash', 
    aiBaseUrl: '',
    systemPrompt: '' 
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    api.get('/config/me')
      .then(res => {
        setConfig({
          aiProvider: res.data.aiProvider || 'gemini',
          aiApiKey: res.data.aiApiKey || '',
          aiModel: res.data.aiModel || 'gemini-1.5-flash',
          aiBaseUrl: res.data.aiBaseUrl || '',
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

  const selectedProvider = providers.find(p => p.id === config.aiProvider) || providers[0];

  if (fetching) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <header>
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Hub Multi-IA</h2>
        <p className="text-slate-500 mt-2">Escolha e configure o provedor de inteligência artificial que alimentará seu gabinete.</p>
      </header>
      
      {/* Provider Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {providers.map((p) => {
          const Icon = p.icon;
          const isActive = config.aiProvider === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setConfig({ ...config, aiProvider: p.id, aiModel: p.models[0] || '' })}
              className={`p-6 rounded-2xl border-2 text-left transition-all duration-200 ${
                isActive 
                  ? 'border-blue-600 bg-blue-50/50 ring-4 ring-blue-50' 
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl bg-white shadow-sm border border-slate-100 ${p.color}`}>
                  <Icon className="h-6 w-6" />
                </div>
                {isActive && <CheckCircle2 className="h-5 w-5 text-blue-600" />}
              </div>
              <h3 className="font-bold text-slate-900 truncate">{p.name}</h3>
              <p className="text-xs text-slate-500 mt-1">Selecionar</p>
            </button>
          );
        })}
      </div>

      {/* Configuration Form */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50">
          <h3 className="font-bold text-slate-800 flex items-center text-lg">
            Configurando {selectedProvider.name}
          </h3>
        </div>
        
        <div className="p-8 space-y-8">
          <div className={`grid grid-cols-1 ${config.aiProvider === 'custom' ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-8`}>
            {config.aiProvider === 'custom' && (
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Base URL</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white"
                  value={config.aiBaseUrl}
                  onChange={e => setConfig({...config, aiBaseUrl: e.target.value})}
                  placeholder="Ex: https://api.openai.com/v1"
                />
              </div>
            )}
            
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">API Key</label>
              <input 
                type="password" 
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white"
                value={config.aiApiKey}
                onChange={e => setConfig({...config, aiApiKey: e.target.value})}
                placeholder={`Sua chave da API do ${selectedProvider.name}`}
              />
              <p className="text-xs text-slate-400 italic">Sua chave é salva de forma segura.</p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">Modelo</label>
              {config.aiProvider === 'custom' ? (
                <input 
                  type="text"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white"
                  value={config.aiModel}
                  onChange={e => setConfig({...config, aiModel: e.target.value})}
                  placeholder="Ex: gpt-4, llama3, etc"
                />
              ) : (
                <div className="flex flex-col gap-2">
                  <select 
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white"
                    value={selectedProvider.models.includes(config.aiModel) ? config.aiModel : 'other'}
                    onChange={e => {
                      const val = e.target.value;
                      if (val !== 'other') {
                        setConfig({...config, aiModel: val});
                      }
                    }}
                  >
                    {selectedProvider.models.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                    <option value="other">Outro modelo...</option>
                  </select>
                  {(!selectedProvider.models.includes(config.aiModel) || config.aiModel === '') && (
                    <input 
                      type="text"
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white"
                      value={config.aiModel}
                      onChange={e => setConfig({...config, aiModel: e.target.value})}
                      placeholder="Digite o nome do modelo"
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">Prompt de Sistema (Personalidade da IA)</label>
            <textarea 
              rows={8}
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white"
              value={config.systemPrompt}
              onChange={e => setConfig({...config, systemPrompt: e.target.value})}
              placeholder="Ex: Você é o assistente virtual do Vereador João Silva. Sua função é receber demandas de cidadãos, ser cordial e extrair a categoria da solicitação (Saúde, Infraestrutura, etc)."
            />
            <p className="mt-2 text-xs text-slate-500 bg-blue-50 p-3 rounded-lg border border-blue-100 flex items-center">
              <CheckCircle2 className="h-4 w-4 mr-2 text-blue-600 flex-shrink-0" />
              Dica: Descreva detalhadamente como a IA deve se comportar e quais informações ela deve priorizar.
            </p>
          </div>

          <div className="pt-6 border-t border-slate-100 flex justify-end">
            <button 
              onClick={handleSave}
              disabled={loading}
              className="bg-blue-600 text-white px-10 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all duration-200 disabled:opacity-50 flex items-center shadow-lg shadow-blue-500/20 active:scale-95"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                  Salvando Configurações...
                </>
              ) : 'Salvar Alterações'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

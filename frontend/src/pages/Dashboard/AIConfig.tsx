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
    systemPrompt: '' 
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    api.get('/config/me')
      .then(res => {
        setConfig({
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
      alert('Personalidade da IA salva com sucesso!');
    } catch (err) {
      alert('Falha ao salvar configuração.');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Personalidade da IA</h2>
        <p className="text-slate-500 mt-2">Defina como a inteligência artificial deve se comportar ao atender os cidadãos do seu gabinete.</p>
      </header>
      
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50">
          <h3 className="font-bold text-slate-800 flex items-center text-lg">
            <Brain className="mr-2 text-blue-600" />
            Prompt de Sistema (Instruções de Comportamento)
          </h3>
        </div>
        
        <div className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">Como a IA deve agir?</label>
            <textarea 
              rows={12}
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white font-medium text-slate-700"
              value={config.systemPrompt}
              onChange={e => setConfig({...config, systemPrompt: e.target.value})}
              placeholder="Ex: Você é o assistente virtual do Vereador João Silva. Sua função é receber demandas de cidadãos, ser cordial e extrair a categoria da solicitação (Saúde, Infraestrutura, etc)."
            />
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                <h4 className="text-xs font-black text-blue-700 uppercase mb-2 flex items-center">
                  <CheckCircle2 size={14} className="mr-1" /> O que incluir:
                </h4>
                <ul className="text-xs text-blue-600 space-y-1 font-medium">
                  <li>• Seu nome e cargo no gabinete</li>
                  <li>• Tom de voz (Ex: Formal, Amigável, Direto)</li>
                  <li>• Regras de encaminhamento de demandas</li>
                </ul>
              </div>
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                <h4 className="text-xs font-black text-amber-700 uppercase mb-2 flex items-center">
                  <Zap size={14} className="mr-1" /> Dica de Ouro:
                </h4>
                <p className="text-xs text-amber-600 font-medium">
                  Quanto mais detalhes você der sobre a sua atuação legislativa, melhor a IA responderá em seu nome.
                </p>
              </div>
            </div>
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
                  Salvando...
                </>
              ) : 'Salvar Personalidade'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


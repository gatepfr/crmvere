import { useState } from 'react';
import api from '../../api/client';
import { 
  Sparkles, 
  FileText, 
  Clapperboard, 
  Share2, 
  Loader2, 
  Copy, 
  CheckCircle2, 
  Send,
  Wand2
} from 'lucide-react';

type ToolType = 'lei' | 'reels' | 'social';

export default function IALab() {
  const [activeTool, setActiveTool] = useState<ToolType | null>(null);
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const tools = [
    {
      id: 'lei',
      title: 'Projeto de Lei',
      desc: 'Crie a base técnica e justificativa para um novo projeto de lei municipal.',
      icon: FileText,
      color: 'bg-blue-600',
      placeholder: 'Ex: Projeto de lei para incentivar a reciclagem em escolas municipais...'
    },
    {
      id: 'reels',
      title: 'Roteiro de Reels',
      desc: 'Gere roteiros dinâmicos com falas e indicações de cenas para vídeos curtos.',
      icon: Clapperboard,
      color: 'bg-purple-600',
      placeholder: 'Ex: Roteiro para mostrar a nova iluminação no bairro Centro...'
    },
    {
      id: 'social',
      title: 'Post de Prestação de Contas',
      desc: 'Transforme uma ação ou demanda resolvida em um texto engajador para redes sociais.',
      icon: Share2,
      color: 'bg-pink-600',
      placeholder: 'Ex: Texto para Instagram sobre a entrega da reforma da UBS...'
    }
  ];

  const handleGenerate = async () => {
    if (!prompt.trim() || !activeTool) return;
    setLoading(true);
    setResult('');
    
    try {
      // We'll create a generic AI processing route in the backend
      const res = await api.post('/ai/generate-content', {
        type: activeTool,
        prompt: prompt
      });
      setResult(res.data.text);
    } catch (err) {
      console.error('Erro ao gerar conteúdo:', err);
      alert('Falha ao gerar conteúdo com IA. Verifique suas configurações de API.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
          <Sparkles className="text-blue-600" />
          Lab IA: Criador de Conteúdo
        </h1>
        <p className="text-slate-500 mt-1">Utilize a inteligência artificial para redigir leis, roteiros e posts oficiais.</p>
      </header>

      {/* Tool Selection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => {
              setActiveTool(tool.id as ToolType);
              setResult('');
              setPrompt('');
            }}
            className={`text-left p-6 rounded-3xl border-2 transition-all duration-300 group ${
              activeTool === tool.id 
                ? 'border-blue-600 bg-blue-50/50 shadow-xl shadow-blue-500/10' 
                : 'border-white bg-white hover:border-slate-200 hover:shadow-lg'
            }`}
          >
            <div className={`w-12 h-12 rounded-2xl ${tool.color} text-white flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
              <tool.icon size={24} />
            </div>
            <h3 className="font-black text-slate-900 text-lg">{tool.title}</h3>
            <p className="text-slate-500 text-sm mt-2 leading-relaxed">{tool.desc}</p>
          </button>
        ))}
      </div>

      {activeTool && (
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="p-8 space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-black text-slate-700 uppercase tracking-widest">
                O que você quer criar?
              </label>
              <textarea
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-6 text-slate-900 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all resize-none font-medium"
                rows={4}
                placeholder={tools.find(t => t.id === activeTool)?.placeholder}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleGenerate}
                disabled={loading || !prompt.trim()}
                className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-black hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/30 disabled:opacity-50 flex items-center gap-3 active:scale-95"
              >
                {loading ? <Loader2 className="animate-spin" size={24} /> : <Wand2 size={24} />}
                {loading ? 'Gerando inteligência...' : 'Gerar com IA'}
              </button>
            </div>

            {result && (
              <div className="mt-8 space-y-4 animate-in zoom-in duration-300">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-green-500" />
                    Resultado Gerado
                  </h4>
                  <button 
                    onClick={copyToClipboard}
                    className="text-blue-600 hover:text-blue-700 font-bold text-sm flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-xl transition-colors"
                  >
                    {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                    {copied ? 'Copiado!' : 'Copiar Texto'}
                  </button>
                </div>
                <div className="bg-slate-900 rounded-3xl p-8 text-slate-100 font-mono text-sm leading-relaxed whitespace-pre-wrap border border-slate-800 shadow-2xl overflow-auto max-h-[500px]">
                  {result}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

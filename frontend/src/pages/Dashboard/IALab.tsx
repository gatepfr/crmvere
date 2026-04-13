import { useState, useRef, useEffect } from 'react';
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
  Wand2,
  RotateCcw,
  User,
  Bot
} from 'lucide-react';

type ToolType = 'lei' | 'reels' | 'social';

interface Message {
  role: 'user' | 'ai';
  content: string;
}

export default function IALab() {
  const [activeTool, setActiveTool] = useState<ToolType | null>(null);
  const [prompt, setPrompt] = useState('');
  const [history, setHistory] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

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
      title: 'Post de Redes Sociais',
      desc: 'Transforme uma ação ou demanda resolvida em um texto engajador para redes sociais.',
      icon: Share2,
      color: 'bg-pink-600',
      placeholder: 'Ex: Texto para Instagram sobre a entrega da reforma da UBS...'
    }
  ];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, loading]);

  const handleGenerate = async () => {
    if (!prompt.trim() || !activeTool) return;
    
    const userMessage: Message = { role: 'user', content: prompt };
    const newHistory = [...history, userMessage];
    
    setHistory(newHistory);
    setPrompt('');
    setLoading(true);
    
    try {
      const res = await api.post('/ai/generate-content', {
        type: activeTool,
        prompt: prompt,
        history: history // Send existing history
      });
      
      const aiMessage: Message = { role: 'ai', content: res.data.text };
      setHistory(prev => [...prev, aiMessage]);
    } catch (err) {
      console.error('Erro ao gerar conteúdo:', err);
      alert('Falha ao gerar conteúdo com IA. Verifique suas configurações de API.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const resetChat = () => {
    if (confirm('Deseja limpar a conversa e começar do zero?')) {
      setHistory([]);
      setPrompt('');
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <Sparkles className="text-blue-600" />
            Lab IA: Criador de Conteúdo
          </h1>
          <p className="text-slate-500 mt-1">Utilize a inteligência artificial para redigir leis, roteiros e posts oficiais.</p>
        </div>
        
        {history.length > 0 && (
          <button 
            onClick={resetChat}
            className="flex items-center gap-2 px-4 py-2 text-slate-500 hover:text-red-600 font-bold text-sm transition-colors border border-slate-200 rounded-xl hover:bg-red-50"
          >
            <RotateCcw size={16} />
            Reiniciar Conversa
          </button>
        )}
      </header>

      {/* Tool Selection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => {
              if (history.length > 0 && !confirm('Trocar de ferramenta limpará a conversa atual. Continuar?')) return;
              setActiveTool(tool.id as ToolType);
              setHistory([]);
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
        <div className="flex flex-col bg-white rounded-3xl shadow-xl border border-slate-100 min-h-[600px] max-h-[800px] overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Chat History Area */}
          <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">
            {history.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40 py-20">
                <Wand2 size={48} className="text-slate-300" />
                <p className="font-bold text-slate-400">Descreva o que você precisa e a IA criará o conteúdo inicial.<br/>Depois você poderá pedir ajustes e melhorias!</p>
              </div>
            )}

            {history.map((msg, index) => (
              <div key={index} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                  msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
                </div>
                
                <div className={`max-w-[85%] space-y-2 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                  <div className={`p-6 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap font-medium shadow-sm border ${
                    msg.role === 'user' 
                      ? 'bg-blue-50 border-blue-100 text-slate-800' 
                      : 'bg-white border-slate-100 text-slate-700'
                  }`}>
                    {msg.content}
                  </div>
                  
                  {msg.role === 'ai' && (
                    <div className="flex justify-start">
                      <button 
                        onClick={() => copyToClipboard(msg.content, index)}
                        className="text-blue-600 hover:text-blue-700 font-bold text-xs flex items-center gap-1.5 px-3 py-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        {copiedIndex === index ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                        {copiedIndex === index ? 'Copiado!' : 'Copiar Texto'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-4 animate-pulse">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                  <Bot size={20} />
                </div>
                <div className="bg-slate-50 border border-slate-100 p-6 rounded-2xl w-32 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-6 bg-slate-50 border-t border-slate-100">
            <div className="relative group">
              <textarea
                className="w-full bg-white border border-slate-200 rounded-2xl p-6 pr-16 text-slate-900 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all resize-none font-medium shadow-inner"
                rows={3}
                placeholder={history.length > 0 ? "Peça alterações (ex: 'Deixe mais curto', 'Adicione um parágrafo sobre...') " : tools.find(t => t.id === activeTool)?.placeholder}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleGenerate();
                  }
                }}
              />
              <button
                onClick={handleGenerate}
                disabled={loading || !prompt.trim()}
                className="absolute right-4 bottom-4 bg-blue-600 text-white p-3 rounded-xl font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/30 disabled:opacity-50 active:scale-95"
              >
                {loading ? <Loader2 className="animate-spin" size={24} /> : <Send size={24} />}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 font-bold text-center mt-3 uppercase tracking-widest">
              Pressione Enter para enviar • A IA mantém o contexto da conversa acima
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

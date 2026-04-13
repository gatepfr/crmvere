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
      desc: 'Base técnica e justificativa.',
      icon: FileText,
      color: 'bg-blue-600',
      borderColor: 'border-blue-200',
      hoverColor: 'hover:border-blue-400',
      placeholder: 'Ex: Projeto de lei para incentivar a reciclagem em escolas municipais...'
    },
    {
      id: 'reels',
      title: 'Roteiro de Reels',
      desc: 'Vídeos curtos e dinâmicos.',
      icon: Clapperboard,
      color: 'bg-purple-600',
      borderColor: 'border-purple-200',
      hoverColor: 'hover:border-purple-400',
      placeholder: 'Ex: Roteiro para mostrar a nova iluminação no bairro Centro...'
    },
    {
      id: 'social',
      title: 'Post Social',
      desc: 'Conteúdo para redes oficiais.',
      icon: Share2,
      color: 'bg-pink-600',
      borderColor: 'border-pink-200',
      hoverColor: 'hover:border-pink-400',
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
        history: history
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
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
          <Sparkles className="text-blue-600" />
          Lab IA: Criador de Conteúdo
        </h1>
        <p className="text-slate-500 mt-1">Gere conteúdos oficiais e refine o resultado através do chat.</p>
      </header>

      {/* Tool Selection - More Compact */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => {
              if (history.length > 0 && !confirm('Trocar de ferramenta limpará a conversa atual. Continuar?')) return;
              setActiveTool(tool.id as ToolType);
              setHistory([]);
              setPrompt('');
            }}
            className={`text-left p-4 rounded-2xl border-2 transition-all duration-300 group flex items-center gap-4 ${
              activeTool === tool.id 
                ? `${tool.borderColor} bg-white shadow-md ring-2 ring-offset-2 ring-blue-500/20` 
                : `border-slate-100 bg-white ${tool.hoverColor} hover:shadow-md`
            }`}
          >
            <div className={`w-10 h-10 rounded-xl ${tool.color} text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform`}>
              <tool.icon size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">{tool.title}</h3>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-tight">{tool.desc}</p>
            </div>
          </button>
        ))}
      </div>

      {activeTool && (
        <div className="flex flex-col bg-white rounded-[2rem] shadow-xl border border-slate-100 min-h-[500px] max-h-[700px] overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
          {/* Header do Chat com Reset */}
          <div className="px-6 py-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full animate-pulse ${tools.find(t => t.id === activeTool)?.color.replace('bg-', 'bg-')}`} />
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                Editando: {tools.find(t => t.id === activeTool)?.title}
              </span>
            </div>
            
            {history.length > 0 && (
              <button 
                onClick={resetChat}
                className="flex items-center gap-1.5 px-3 py-1.5 text-slate-400 hover:text-red-500 font-bold text-[10px] transition-all uppercase tracking-widest border border-transparent hover:border-red-100 rounded-lg"
              >
                <RotateCcw size={12} />
                Limpar Chat
              </button>
            )}
          </div>

          {/* Chat History Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            {history.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40 py-20">
                <div className={`p-4 rounded-3xl bg-slate-50 text-slate-300`}>
                  <Wand2 size={40} />
                </div>
                <p className="text-sm font-bold text-slate-400">
                  Descreva o tema inicial e a IA criará o conteúdo.<br/>
                  Depois você poderá pedir ajustes.
                </p>
              </div>
            )}

            {history.map((msg, index) => (
              <div key={index} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${
                  msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                
                <div className={`max-w-[85%] space-y-2 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                  <div className={`p-5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap font-medium shadow-sm border ${
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
                        className="text-blue-600 hover:text-blue-700 font-bold text-[10px] uppercase tracking-widest flex items-center gap-1.5 px-3 py-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        {copiedIndex === index ? <CheckCircle2 size={12} /> : <Copy size={12} />}
                        {copiedIndex === index ? 'Copiado!' : 'Copiar Texto'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-3 animate-pulse">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                  <Bot size={16} />
                </div>
                <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex items-center gap-2">
                  <div className="w-1 h-1 bg-slate-300 rounded-full animate-bounce" />
                  <div className="w-1 h-1 bg-slate-300 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-1 h-1 bg-slate-300 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-6 bg-slate-50/50 border-t border-slate-100">
            <div className="relative group max-w-4xl mx-auto">
              <textarea
                className="w-full bg-white border border-slate-200 rounded-2xl p-5 pr-14 text-sm text-slate-900 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all resize-none font-medium shadow-sm"
                rows={2}
                placeholder={history.length > 0 ? "Peça alterações (ex: 'Deixe mais curto', 'Mude o tom...') " : tools.find(t => t.id === activeTool)?.placeholder}
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
                className="absolute right-3 bottom-3 bg-blue-600 text-white p-2.5 rounded-xl font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/30 disabled:opacity-50 active:scale-95"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
              </button>
            </div>
            <p className="text-[9px] text-slate-400 font-bold text-center mt-3 uppercase tracking-widest">
              Enter para enviar • Shift + Enter para quebrar linha
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import api from '../../api/client';
import { 
  Bot, Brain, CheckCircle2, Loader2, Zap, 
  FileText, Upload, Trash2, FileIcon, Shield,
  Database
} from 'lucide-react';

interface Document {
  id: string;
  fileName: string;
  fileType: string;
  createdAt: string;
}

export default function AIConfig() {
  const [activeTab, setActiveTab] = useState<'personality' | 'knowledge'>('personality');
  const [config, setConfig] = useState({ systemPrompt: '' });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  // Knowledge Base States
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const fetchConfig = useCallback(() => {
    setFetching(true);
    api.get('/config/me')
      .then(res => setConfig({ systemPrompt: res.data.systemPrompt || '' }))
      .catch(err => console.error(err))
      .finally(() => setFetching(false));
  }, []);

  const fetchDocuments = useCallback(async () => {
    try {
      const response = await api.get('/knowledge');
      setDocuments(response.data);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => {
    fetchConfig();
    fetchDocuments();
  }, [fetchConfig, fetchDocuments]);

  const handleSaveConfig = async () => {
    setLoading(true);
    try {
      await api.patch('/config/update', config);
      alert('Personalidade da IA salva!');
    } catch (err) { alert('Falha ao salvar'); } finally { setLoading(false); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    const formData = new FormData();
    formData.append('file', file);
    try {
      await api.post('/knowledge/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      fetchDocuments();
    } catch (err: any) { setError(err.response?.data?.error || 'Falha no upload'); } finally { setUploading(false); }
  };

  const handleDeleteDoc = async (id: string) => {
    if (!confirm('Excluir documento?')) return;
    try {
      await api.delete(`/knowledge/${id}`);
      setDocuments(docs => docs.filter(d => d.id !== id));
    } catch (err) { alert('Falha ao excluir'); }
  };

  if (fetching) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <Bot className="text-blue-600" size={32} />
          Inteligência do Gabinete
        </h1>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Treine sua IA para atender melhor os munícipes</p>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
        <button onClick={() => setActiveTab('personality')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'personality' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>
          <Brain size={14} /> Personalidade
        </button>
        <button onClick={() => setActiveTab('knowledge')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'knowledge' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>
          <Database size={14} /> Base de Dados (Treinamento)
        </button>
      </div>

      <div className="min-h-[500px]">
        {/* PERSONALITY TAB */}
        {activeTab === 'personality' && (
          <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-slate-100 animate-in slide-in-from-left-4 duration-300">
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2 mb-8">
              <Shield size={20} className="text-blue-600" />
              Instruções de Comportamento
            </h3>
            <div className="space-y-6 max-w-4xl">
              <textarea 
                rows={12}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-3xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-slate-700"
                value={config.systemPrompt}
                onChange={e => setConfig({...config, systemPrompt: e.target.value})}
                placeholder="Ex: Você é o assistente virtual do Vereador..."
              />
              <div className="flex justify-end">
                <span className={`text-[10px] font-black uppercase tracking-widest ${config.systemPrompt.length > 4000 ? 'text-red-500' : 'text-slate-300'}`}>
                  {config.systemPrompt.length} / 4000 caracteres
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100">
                  <h4 className="text-[10px] font-black text-blue-700 uppercase mb-3 flex items-center gap-2">
                    <CheckCircle2 size={14} /> Sugestões de Escrita
                  </h4>
                  <ul className="text-xs text-blue-600 space-y-2 font-bold opacity-80 uppercase tracking-tighter">
                    <li>• Identifique o Verêador e o Município</li>
                    <li>• Defina se o tom é formal ou amigável</li>
                    <li>• Liste as áreas de atuação principal</li>
                  </ul>
                </div>
                <div className="flex items-end justify-end">
                  <button onClick={handleSaveConfig} disabled={loading} className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all">
                    {loading ? 'Salvando...' : 'SALVAR ALTERAÇÕES'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* KNOWLEDGE TAB */}
        {activeTab === 'knowledge' && (
          <div className="space-y-8 animate-in slide-in-from-left-4 duration-300">
            <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-slate-100 text-center">
              <div className="max-w-xl mx-auto space-y-6">
                <div className="relative group border-2 border-dashed border-slate-200 rounded-[2rem] p-12 hover:border-blue-500 transition-all cursor-pointer">
                  <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleFileUpload} disabled={uploading} accept=".pdf,.txt,.docx" />
                  <div className="flex flex-col items-center">
                    {uploading ? <Loader2 className="h-12 w-12 text-blue-600 animate-spin mb-4" /> : <Upload className="h-12 w-12 text-slate-300 group-hover:text-blue-600 mb-4 transition-all" />}
                    <h3 className="text-lg font-black text-slate-700 uppercase tracking-tighter">{uploading ? 'Processando...' : 'Carregar Documentos'}</h3>
                    <p className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-widest">PDF, TXT ou DOCX (Leis e Decretos)</p>
                  </div>
                </div>
                {error && <p className="text-red-500 text-[10px] font-black uppercase">{error}</p>}
              </div>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                <h3 className="font-black text-slate-900 text-sm uppercase tracking-widest flex items-center gap-2">
                  <FileText size={16} className="text-blue-600" /> Documentos de Referência
                </h3>
                <span className="px-3 py-1 bg-white border border-slate-200 rounded-full text-[10px] font-black text-slate-400">{documents.length} ARQUIVOS</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <tbody className="divide-y divide-slate-50">
                    {documents.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600"><FileIcon size={18} /></div>
                            <span className="font-bold text-slate-800 text-sm">{doc.fileName}</span>
                          </div>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <button onClick={() => handleDeleteDoc(doc.id)} className="p-2 text-slate-300 hover:text-red-600 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={18} /></button>
                        </td>
                      </tr>
                    ))}
                    {documents.length === 0 && (
                      <tr><td className="px-8 py-10 text-center text-slate-400 font-bold">Nenhum documento para treinamento ainda.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

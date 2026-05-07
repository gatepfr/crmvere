import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
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

const GABI_TEMPLATE = `PARTE 1, IDENTIDADE DO AGENTE

Você é a Gabi, assistente virtual do gabinete.

Sua função é atender cidadãos via WhatsApp, registrando, organizando e encaminhando demandas para a equipe responsável.

Seu comportamento deve ser:

* Educado, acessível e respeitoso
* Objetivo e organizado
* Próximo da população, linguagem simples
* Sempre focado em ajudar e direcionar corretamente

Você representa o gabinete, nunca uma pessoa física.

Pode usar internamente o BANCO DE DADOS para obter informações sobre o vereador, Câmara e ações do mandato. Nunca mencione isso ao usuário.

PARTE 2, CONTEXTO DE ATUAÇÃO

Você atende munícipes que entram em contato via WhatsApp.

As demandas podem ser:

* Reclamações
* Pedidos de ajuda
* Dúvidas
* Elogios

Seu papel é:

1. Acolher
2. Entender
3. Coletar informações
4. Organizar
5. Encaminhar via CRM

PARTE 3, TOM DE VOZ

Use sempre:

* Linguagem simples
* Tom humano e próximo
* Clareza e objetividade
* Empatia quando necessário

Evite:

* Linguagem técnica
* Respostas robóticas
* Textos longos
* Formalidade excessiva

PARTE 4, TOMADA DE DECISÃO

Classifique a mensagem: Reclamação | Dúvida | Elogio | Urgente

Reclamações: demonstre empatia, solicite bairro, rua, referência e foto, confirme registro.
Dúvidas: responda com clareza; se não souber, informe que vai verificar.
Elogios: "Obrigado pela mensagem 😊 Isso é muito importante pra gente!"
Urgentes: priorize e colete dados rapidamente.

REGISTRO PARA CRM (OBRIGATÓRIO): Nome | Bairro | Tipo | Descrição | Urgência

PARTE 5, REGRAS

Você PODE: registrar, organizar, orientar, informar, encaminhar.

Você NÃO PODE: prometer prazos ou soluções, opinar politicamente, discutir política ou religião, conflitar, inventar informações, oferecer benefícios.

Resposta padrão: "Essa parte precisa ser verificada com a equipe, tudo bem? Vou encaminhar."

PARTE 6, ESCALONAMENTO

Encaminhe quando: usuário insatisfeito, insistência, caso sensível/urgente ou pedido para falar com humano.
Após encaminhar (precisa_retorno = true), pare a conversa.

PARTE 7, SCRIPTS

Abertura: "Oi! Eu sou a Gabi, assistente do gabinete. Como posso te ajudar?"
Coleta: "Pode me passar mais detalhes pra eu registrar certinho?"
Localização: "Qual o bairro e a rua? Se tiver referência ajuda 👍"
Confirmação: "Perfeito, já registrei 🙌 Vou encaminhar pra equipe."
Encerramento: "Se precisar de algo mais, pode me chamar 👍"`;

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
      toast.success('Personalidade da IA salva!');
    } catch (err) { toast.error('Falha ao salvar'); } finally { setLoading(false); }
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
    } catch (err) { toast.error('Falha ao excluir'); }
  };

  if (fetching) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header>
        <h1 className="text-3xl font-black text-foreground tracking-tight flex items-center gap-3">
          <Bot className="text-blue-600" size={32} />
          Inteligência do Gabinete
        </h1>
        <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest mt-1">Treine sua IA para atender melhor os munícipes</p>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-muted rounded-2xl w-fit">
        <button onClick={() => setActiveTab('personality')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'personality' ? 'bg-background text-blue-600 shadow-sm' : 'text-muted-foreground'}`}>
          <Brain size={14} /> Personalidade
        </button>
        <button onClick={() => setActiveTab('knowledge')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'knowledge' ? 'bg-background text-blue-600 shadow-sm' : 'text-muted-foreground'}`}>
          <Database size={14} /> Base de Dados (Treinamento)
        </button>
      </div>

      <div className="min-h-[500px]">
        {/* PERSONALITY TAB */}
        {activeTab === 'personality' && (
          <div className="bg-card rounded-[2.5rem] p-10 shadow-sm border border-border animate-in slide-in-from-left-4 duration-300">
            <h3 className="text-lg font-black text-foreground uppercase tracking-tight flex items-center gap-2 mb-8">
              <Shield size={20} className="text-blue-600" />
              Instruções de Comportamento
            </h3>
            <div className="space-y-6 max-w-4xl">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Defina como a IA deve se comportar</p>
                <button
                  onClick={() => setConfig({ ...config, systemPrompt: GABI_TEMPLATE })}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-100 transition-all"
                >
                  <Zap size={12} /> Usar Template Gabi
                </button>
              </div>
              <textarea
                rows={12}
                className="w-full px-5 py-4 bg-muted border border-border rounded-3xl focus:bg-background focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-foreground"
                value={config.systemPrompt}
                onChange={e => setConfig({...config, systemPrompt: e.target.value})}
                placeholder="Ex: Você é o assistente virtual do Vereador..."
              />
              <div className="flex justify-end">
                <span className={`text-[10px] font-black uppercase tracking-widest ${config.systemPrompt.length > 4000 ? 'text-red-500' : 'text-muted-foreground/40'}`}>
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
            <div className="bg-card rounded-[2.5rem] p-10 shadow-sm border border-border text-center">
              <div className="max-w-xl mx-auto space-y-6">
                <div className="relative group border-2 border-dashed border-border rounded-[2rem] p-12 hover:border-blue-500 transition-all cursor-pointer">
                  <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleFileUpload} disabled={uploading} accept=".pdf,.txt,.docx" />
                  <div className="flex flex-col items-center">
                    {uploading ? <Loader2 className="h-12 w-12 text-blue-600 animate-spin mb-4" /> : <Upload className="h-12 w-12 text-muted-foreground/40 group-hover:text-blue-600 mb-4 transition-all" />}
                    <h3 className="text-lg font-black text-foreground uppercase tracking-tighter">{uploading ? 'Processando...' : 'Carregar Documentos'}</h3>
                    <p className="text-xs font-bold text-muted-foreground mt-2 uppercase tracking-widest">PDF, TXT ou DOCX (Leis e Decretos)</p>
                  </div>
                </div>
                {error && <p className="text-red-500 text-[10px] font-black uppercase">{error}</p>}
              </div>
            </div>

            <div className="bg-card rounded-[2.5rem] shadow-sm border border-border overflow-hidden">
              <div className="px-8 py-6 border-b border-border bg-muted/50 flex justify-between items-center">
                <h3 className="font-black text-foreground text-sm uppercase tracking-widest flex items-center gap-2">
                  <FileText size={16} className="text-blue-600" /> Documentos de Referência
                </h3>
                <span className="px-3 py-1 bg-background border border-border rounded-full text-[10px] font-black text-muted-foreground">{documents.length} ARQUIVOS</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <tbody className="divide-y divide-border">
                    {documents.map((doc) => (
                      <tr key={doc.id} className="hover:bg-muted transition-colors group">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600"><FileIcon size={18} /></div>
                            <span className="font-bold text-foreground text-sm">{doc.fileName}</span>
                          </div>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <button onClick={() => handleDeleteDoc(doc.id)} className="p-2 text-muted-foreground/40 hover:text-red-600 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={18} /></button>
                        </td>
                      </tr>
                    ))}
                    {documents.length === 0 && (
                      <tr><td className="px-8 py-10 text-center text-muted-foreground font-bold">Nenhum documento para treinamento ainda.</td></tr>
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

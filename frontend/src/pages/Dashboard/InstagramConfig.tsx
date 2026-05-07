import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import api, { API_BASE_URL } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  Camera,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Settings2,
  Bot,
  MessageCircle,
  Plus,
  Trash2,
  ExternalLink,
  MessageSquare,
  Loader2,
  Zap,
  Copy,
} from 'lucide-react';

interface InstagramStatus {
  connected: boolean;
  username?: string;
  error?: string;
}

interface CommentRule {
  id: string;
  mediaId: string;
  mediaLabel: string;
  keywords: string;
  replyMessage: string;
}

interface QuickReplyFlow {
  id: string;
  triggerPayload: string;
  responseMessage: string;
  nextQuickReplies?: string | null;
}

type Tab = 'conexao' | 'dms' | 'comentarios';

const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
      checked ? 'bg-blue-800' : 'bg-muted ring-1 ring-border'
    }`}
  >
    <span
      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition duration-200 ease-in-out ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`}
    />
  </button>
);

export default function InstagramConfig() {
  const [activeTab, setActiveTab] = useState<Tab>('conexao');
  const [config, setConfig] = useState({
    instagramAccessToken: '',
    instagramWebhookVerifyToken: '',
    instagramDmAiEnabled: true,
    instagramAutoCreateMunicipe: true,
    instagramBotEnabled: false,
    instagramCommentKeywords: [] as string[],
    instagramCommentReply: '',
    instagramStoryMentionReply: '',
    instagramStoryReply: '',
    instagramDefaultQuickReplies: [] as { title: string; payload: string }[],
  });
  const [status, setStatus] = useState<InstagramStatus | null>(null);
  const [rules, setRules] = useState<CommentRule[]>([]);
  const [qrFlows, setQrFlows] = useState<QuickReplyFlow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  const [newRule, setNewRule] = useState({ mediaId: '', mediaLabel: '', keywords: '', replyMessage: '' });
  const [addingRule, setAddingRule] = useState(false);
  const [newQr, setNewQr] = useState({ title: '', payload: '' });
  const [newFlow, setNewFlow] = useState({ triggerPayload: '', responseMessage: '' });
  const [addingFlow, setAddingFlow] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await api.get('/config/me');
      const d = res.data;
      setConfig({
        instagramAccessToken: d.instagramAccessToken || '',
        instagramWebhookVerifyToken: d.instagramWebhookVerifyToken || '',
        instagramDmAiEnabled: d.instagramDmAiEnabled ?? true,
        instagramAutoCreateMunicipe: d.instagramAutoCreateMunicipe ?? true,
        instagramBotEnabled: d.instagramBotEnabled || false,
        instagramCommentKeywords: d.instagramCommentKeywords ? JSON.parse(d.instagramCommentKeywords) : [],
        instagramCommentReply: d.instagramCommentReply || '',
        instagramStoryMentionReply: d.instagramStoryMentionReply || '',
        instagramStoryReply: d.instagramStoryReply || '',
        instagramDefaultQuickReplies: d.instagramDefaultQuickReplies ? JSON.parse(d.instagramDefaultQuickReplies) : [],
      });
    } catch {
      toast.error('Falha ao carregar configurações.');
    } finally {
      setFetching(false);
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get('/instagram/status');
      setStatus(res.data);
    } catch {
      setStatus({ connected: false });
    }
  }, []);

  const fetchRules = useCallback(async () => {
    try {
      const res = await api.get('/instagram/comment-rules');
      setRules(res.data || []);
    } catch { }
  }, []);

  const fetchFlows = useCallback(async () => {
    try {
      const res = await api.get('/instagram/quick-reply-flows');
      setQrFlows(res.data || []);
    } catch { }
  }, []);

  useEffect(() => {
    fetchConfig();
    fetchStatus();
    fetchRules();
    fetchFlows();
  }, [fetchConfig, fetchStatus, fetchRules, fetchFlows]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/instagram/setup', {
        ...config,
        instagramCommentKeywords: JSON.stringify(config.instagramCommentKeywords),
        instagramDefaultQuickReplies: JSON.stringify(config.instagramDefaultQuickReplies),
      });
      await fetchStatus();
      toast.success('Configurações do Instagram salvas!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const addKeyword = () => {
    const kw = newKeyword.trim().toUpperCase();
    if (kw && !config.instagramCommentKeywords.includes(kw)) {
      setConfig(prev => ({ ...prev, instagramCommentKeywords: [...prev.instagramCommentKeywords, kw] }));
      setNewKeyword('');
    }
  };

  const removeKeyword = (kw: string) =>
    setConfig(prev => ({ ...prev, instagramCommentKeywords: prev.instagramCommentKeywords.filter(k => k !== kw) }));

  const addDefaultQr = () => {
    const t = newQr.title.trim();
    const p = newQr.payload.trim().toUpperCase();
    if (t && p && config.instagramDefaultQuickReplies.length < 13) {
      setConfig(prev => ({ ...prev, instagramDefaultQuickReplies: [...prev.instagramDefaultQuickReplies, { title: t, payload: p }] }));
      setNewQr({ title: '', payload: '' });
    }
  };

  const removeDefaultQr = (idx: number) =>
    setConfig(prev => ({ ...prev, instagramDefaultQuickReplies: prev.instagramDefaultQuickReplies.filter((_, i) => i !== idx) }));

  const handleAddRule = async () => {
    if (!newRule.mediaId || !newRule.mediaLabel || !newRule.keywords || !newRule.replyMessage) {
      toast.error('Preencha todos os campos da regra.');
      return;
    }
    setAddingRule(true);
    try {
      await api.post('/instagram/comment-rules', {
        ...newRule,
        keywords: newRule.keywords.split(',').map(k => k.trim().toUpperCase()).filter(Boolean),
      });
      setNewRule({ mediaId: '', mediaLabel: '', keywords: '', replyMessage: '' });
      await fetchRules();
      toast.success('Regra adicionada!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao adicionar regra.');
    } finally {
      setAddingRule(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    await api.delete(`/instagram/comment-rules/${id}`);
    setRules(prev => prev.filter(r => r.id !== id));
    toast.success('Regra removida.');
  };

  const handleAddFlow = async () => {
    if (!newFlow.triggerPayload || !newFlow.responseMessage) {
      toast.error('Preencha payload e resposta.');
      return;
    }
    setAddingFlow(true);
    try {
      await api.post('/instagram/quick-reply-flows', newFlow);
      setNewFlow({ triggerPayload: '', responseMessage: '' });
      await fetchFlows();
      toast.success('Flow adicionado!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao adicionar flow.');
    } finally {
      setAddingFlow(false);
    }
  };

  const handleDeleteFlow = async (id: string) => {
    await api.delete(`/instagram/quick-reply-flows/${id}`);
    setQrFlows(prev => prev.filter(f => f.id !== id));
    toast.success('Flow removido.');
  };

  const generateVerifyToken = () => {
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    setConfig(prev => ({ ...prev, instagramWebhookVerifyToken: token }));
  };


  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success('URL copiada!');
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'conexao', label: 'Conexão', icon: Settings2 },
    { id: 'dms', label: 'DMs & IA', icon: MessageCircle },
    { id: 'comentarios', label: 'Comentários', icon: Bot },
  ];

  const { user } = useAuth();
  const backendUrl = API_BASE_URL.replace(/\/api$/, '');
  const webhookUrl = `${backendUrl}/api/webhook/instagram/${user?.tenantId ?? 'SEU_TENANT_ID'}`;

  if (fetching) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 text-blue-800 animate-spin" />
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700">

      {/* Header */}
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight flex items-center gap-3">
            <Camera className="text-blue-800" size={32} />
            Conexão Instagram
          </h1>
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest mt-1">
            DMs com IA, robô de comentários e regras por post
          </p>
        </div>

        {/* Status pill */}
        {status?.connected ? (
          <div className="flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-full">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span className="text-xs font-black text-green-700 dark:text-green-400 uppercase tracking-widest">
              @{status.username}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-4 py-2 bg-muted border border-border rounded-full">
            <AlertCircle className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">Não conectado</span>
          </div>
        )}
      </header>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-muted rounded-2xl w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
              activeTab === tab.id
                ? 'bg-background text-blue-900 shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB: CONEXÃO ── */}
      {activeTab === 'conexao' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in slide-in-from-left-4 duration-300">

          {/* Credentials */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-card rounded-[2.5rem] shadow-sm border border-border p-8 space-y-6">
              <h3 className="font-black text-foreground text-sm uppercase tracking-widest flex items-center gap-2">
                <Settings2 size={16} className="text-blue-800" />
                Credenciais da Meta API
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">
                    Access Token (Page Token)
                  </label>
                  <input
                    type="password"
                    className="w-full px-4 py-3 bg-muted border border-border rounded-2xl text-sm font-bold text-foreground outline-none focus:ring-2 focus:ring-blue-400 transition-all"
                    value={config.instagramAccessToken}
                    onChange={e => setConfig({ ...config, instagramAccessToken: e.target.value })}
                    placeholder="EAAxxxxxxxxx..."
                  />
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    Meta for Developers → seu App → Instagram → Token de Acesso da Página.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">
                    Verify Token (Webhook)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 px-4 py-3 bg-muted border border-border rounded-2xl text-sm font-bold text-foreground outline-none focus:ring-2 focus:ring-blue-400 transition-all"
                      value={config.instagramWebhookVerifyToken}
                      onChange={e => setConfig({ ...config, instagramWebhookVerifyToken: e.target.value })}
                      placeholder="token-secreto"
                    />
                    <button
                      onClick={generateVerifyToken}
                      className="px-4 py-3 bg-muted hover:bg-muted/80 border border-border rounded-2xl text-xs font-black text-muted-foreground whitespace-nowrap transition-all"
                    >
                      <Zap size={14} />
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-2xl border border-blue-100 dark:border-blue-800">
                  <p className="text-xs font-black text-blue-800 dark:text-blue-300 mb-2 uppercase tracking-widest">
                    URL do Webhook
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs text-blue-600 dark:text-blue-400 break-all font-mono">
                      {webhookUrl}
                    </code>
                    <button
                      onClick={copyWebhook}
                      className="p-2 text-blue-400 hover:text-blue-600 transition-colors flex-shrink-0"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-8 py-3 bg-blue-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-900 shadow-lg shadow-blue-200 dark:shadow-blue-900/30 transition-all disabled:opacity-50"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  {saving ? 'Salvando...' : 'Salvar Credenciais'}
                </button>
              </div>
            </div>
          </div>

          {/* Status sidebar */}
          <div className="space-y-4">
            <div className="bg-card rounded-[2.5rem] shadow-sm border border-border p-8 flex flex-col items-center justify-center text-center min-h-[280px]">
              {status?.connected ? (
                <div className="space-y-4">
                  <div className="w-20 h-20 bg-green-50 dark:bg-green-950/30 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-10 h-10 text-green-500" />
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-foreground">Conectado!</h4>
                    <p className="text-sm text-muted-foreground mt-1">@{status.username}</p>
                  </div>
                  <button onClick={fetchStatus} className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-xs font-bold mx-auto transition-colors">
                    <RefreshCw className="w-3 h-3" /> Verificar
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto">
                    <Camera className="w-10 h-10 text-muted-foreground/30" />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-foreground">Não conectado</h4>
                    <p className="text-sm text-muted-foreground mt-1">{status?.error || 'Configure o Access Token.'}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-[2.5rem] p-6 space-y-3">
              <h4 className="font-black text-xs text-amber-800 dark:text-amber-300 uppercase tracking-widest">Passos</h4>
              <ol className="space-y-2 text-xs text-amber-700 dark:text-amber-400 font-bold list-decimal list-inside">
                <li>Crie um App em developers.facebook.com</li>
                <li>Adicione o produto "Instagram"</li>
                <li>Gere um Page Access Token longo</li>
                <li>Configure o Webhook com a URL acima</li>
                <li>Assine: <code>messages</code> e <code>comments</code></li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: DMs & IA ── */}
      {activeTab === 'dms' && (
        <div className="space-y-6 animate-in slide-in-from-left-4 duration-300">

          {/* Toggles */}
          <div className="bg-card rounded-[2.5rem] shadow-sm border border-border p-8 space-y-5">
            <h3 className="font-black text-foreground text-sm uppercase tracking-widest flex items-center gap-2">
              <MessageCircle size={16} className="text-blue-500" />
              DMs Recebidas
            </h3>

            <div className="flex items-center justify-between p-4 bg-muted rounded-2xl">
              <div>
                <p className="text-sm font-black text-foreground">Cadastrar automaticamente no banco</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {config.instagramAutoCreateMunicipe
                    ? 'Quem mandar DM será cadastrado automaticamente como munícipe.'
                    : 'Somente munícipes já cadastrados terão DMs processadas.'}
                </p>
              </div>
              <Toggle checked={config.instagramAutoCreateMunicipe} onChange={v => setConfig({ ...config, instagramAutoCreateMunicipe: v })} />
            </div>

            <div className="flex items-center justify-between p-4 bg-muted rounded-2xl">
              <div>
                <p className="text-sm font-black text-foreground">Resposta automática por IA</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {config.instagramDmAiEnabled
                    ? 'IA responde automaticamente (igual ao WhatsApp).'
                    : 'DMs salvas no painel — equipe responde manualmente.'}
                </p>
              </div>
              <Toggle checked={config.instagramDmAiEnabled} onChange={v => setConfig({ ...config, instagramDmAiEnabled: v })} />
            </div>
          </div>

          {/* Stories */}
          <div className="bg-card rounded-[2.5rem] shadow-sm border border-border p-8 space-y-5">
            <h3 className="font-black text-foreground text-sm uppercase tracking-widest flex items-center gap-2">
              <Camera size={16} className="text-blue-800" />
              Respostas a Stories
            </h3>
            <p className="text-xs text-muted-foreground">Quando alguém menciona seu perfil ou responde um Story, o bot envia DM automática.</p>

            <div>
              <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">Menção nos Stories (@conta)</label>
              <textarea
                className="w-full px-4 py-3 bg-muted border border-border rounded-2xl text-sm font-bold text-foreground outline-none focus:ring-2 focus:ring-blue-400 transition-all resize-none"
                rows={2}
                value={config.instagramStoryMentionReply}
                onChange={e => setConfig({ ...config, instagramStoryMentionReply: e.target.value })}
                placeholder="Oi! Vi que você nos mencionou nos Stories. Como posso ajudar?"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">Resposta ao Story</label>
              <textarea
                className="w-full px-4 py-3 bg-muted border border-border rounded-2xl text-sm font-bold text-foreground outline-none focus:ring-2 focus:ring-blue-400 transition-all resize-none"
                rows={2}
                value={config.instagramStoryReply}
                onChange={e => setConfig({ ...config, instagramStoryReply: e.target.value })}
                placeholder="Oi! Obrigado por responder nosso Story. Como posso ajudar?"
              />
            </div>
          </div>

          {/* Quick Replies */}
          <div className="bg-card rounded-[2.5rem] shadow-sm border border-border p-8 space-y-5">
            <h3 className="font-black text-foreground text-sm uppercase tracking-widest flex items-center gap-2">
              <MessageSquare size={16} className="text-indigo-500" />
              Quick Replies (Botões nas DMs)
            </h3>
            <p className="text-xs text-muted-foreground">Botões exibidos ao final das respostas da IA. Limite: 13 botões, máx 20 caracteres cada.</p>

            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 px-4 py-3 bg-muted border border-border rounded-2xl text-sm font-bold text-foreground outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
                value={newQr.title}
                onChange={e => setNewQr({ ...newQr, title: e.target.value.slice(0, 20) })}
                placeholder="Texto do botão (máx 20)"
              />
              <input
                type="text"
                className="flex-1 px-4 py-3 bg-muted border border-border rounded-2xl text-sm font-bold text-foreground outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
                value={newQr.payload}
                onChange={e => setNewQr({ ...newQr, payload: e.target.value.toUpperCase() })}
                placeholder="PAYLOAD"
              />
              <button onClick={addDefaultQr} className="p-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl transition-colors">
                <Plus size={16} />
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {config.instagramDefaultQuickReplies.map((qr, i) => (
                <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-black">
                  {qr.title}
                  <span className="opacity-40 text-[9px]">{qr.payload}</span>
                  <button onClick={() => removeDefaultQr(i)} className="hover:text-red-500 transition-colors"><Trash2 size={11} /></button>
                </span>
              ))}
              {config.instagramDefaultQuickReplies.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum quick reply configurado.</p>
              )}
            </div>

            {/* Flows */}
            {qrFlows.length > 0 && (
              <div className="space-y-2 pt-4 border-t border-border">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Flows por Payload</p>
                {qrFlows.map(flow => (
                  <div key={flow.id} className="flex items-center justify-between p-3 bg-muted rounded-2xl border border-border">
                    <div>
                      <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 px-2 py-0.5 rounded-lg">{flow.triggerPayload}</span>
                      <p className="text-xs text-muted-foreground mt-1">"{flow.responseMessage}"</p>
                    </div>
                    <button onClick={() => handleDeleteFlow(flow.id)} className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="border border-dashed border-border rounded-2xl p-5 space-y-3">
              <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Novo Flow</p>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  className="px-3 py-2.5 bg-muted border border-border rounded-xl text-xs font-bold text-foreground outline-none focus:ring-2 focus:ring-indigo-400"
                  value={newFlow.triggerPayload}
                  onChange={e => setNewFlow({ ...newFlow, triggerPayload: e.target.value.toUpperCase() })}
                  placeholder="PAYLOAD do botão"
                />
                <input
                  type="text"
                  className="px-3 py-2.5 bg-muted border border-border rounded-xl text-xs font-bold text-foreground outline-none focus:ring-2 focus:ring-indigo-400"
                  value={newFlow.responseMessage}
                  onChange={e => setNewFlow({ ...newFlow, responseMessage: e.target.value })}
                  placeholder="Resposta automática"
                />
              </div>
              <button
                onClick={handleAddFlow}
                disabled={addingFlow}
                className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {addingFlow ? 'Adicionando...' : '+ Adicionar Flow'}
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-8 py-3 bg-blue-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-900 shadow-lg shadow-blue-200 dark:shadow-blue-900/30 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              {saving ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </div>
        </div>
      )}

      {/* ── TAB: COMENTÁRIOS ── */}
      {activeTab === 'comentarios' && (
        <div className="space-y-6 animate-in slide-in-from-left-4 duration-300">

          {/* Global bot */}
          <div className="bg-card rounded-[2.5rem] shadow-sm border border-border p-8 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-foreground text-sm uppercase tracking-widest flex items-center gap-2">
                <Bot size={16} className="text-purple-500" />
                Robô de Comentários (Global)
              </h3>
              <Toggle checked={config.instagramBotEnabled} onChange={v => setConfig({ ...config, instagramBotEnabled: v })} />
            </div>
            <p className="text-xs text-muted-foreground">Funciona em todos os posts. Se o comentário contiver a palavra-chave, o bot responde via DM.</p>

            <div>
              <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">Palavras-chave</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 px-4 py-3 bg-muted border border-border rounded-2xl text-sm font-bold text-foreground outline-none focus:ring-2 focus:ring-blue-400 transition-all"
                  value={newKeyword}
                  onChange={e => setNewKeyword(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && addKeyword()}
                  placeholder="QUERO, INFO, AJUDA..."
                />
                <button onClick={addKeyword} className="p-3 bg-blue-800 hover:bg-blue-900 text-white rounded-2xl transition-colors">
                  <Plus size={16} />
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {config.instagramCommentKeywords.map(kw => (
                  <span key={kw} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-black">
                    {kw}
                    <button onClick={() => removeKeyword(kw)} className="hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
                  </span>
                ))}
                {config.instagramCommentKeywords.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhuma palavra-chave configurada.</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">Resposta automática</label>
              <textarea
                className="w-full px-4 py-3 bg-muted border border-border rounded-2xl text-sm font-bold text-foreground outline-none focus:ring-2 focus:ring-blue-400 transition-all resize-none"
                rows={3}
                value={config.instagramCommentReply}
                onChange={e => setConfig({ ...config, instagramCommentReply: e.target.value })}
                placeholder="Obrigado pelo comentário! Em breve te mandamos uma DM."
              />
            </div>
          </div>

          {/* Per-post rules */}
          <div className="bg-card rounded-[2.5rem] shadow-sm border border-border overflow-hidden">
            <div className="px-8 py-6 border-b border-border bg-muted/50 flex justify-between items-center">
              <h3 className="font-black text-foreground text-sm uppercase tracking-widest flex items-center gap-2">
                <ExternalLink size={16} className="text-green-500" />
                Regras por Post Específico
              </h3>
              <span className="px-3 py-1 bg-background border border-border rounded-full text-[10px] font-black text-muted-foreground">
                {rules.length} REGRAS
              </span>
            </div>

            <div className="p-8 space-y-4">
              <p className="text-xs text-muted-foreground">Regras por post têm prioridade sobre as globais. Copie o ID do post no link do Instagram.</p>

              {rules.length > 0 && (
                <div className="space-y-3">
                  {rules.map(rule => (
                    <div key={rule.id} className="flex items-start justify-between p-4 bg-muted rounded-2xl border border-border gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-foreground text-sm truncate">{rule.mediaLabel}</p>
                        <p className="text-[10px] text-muted-foreground font-mono truncate mt-0.5">ID: {rule.mediaId}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {(JSON.parse(rule.keywords) as string[]).map(kw => (
                            <span key={kw} className="px-2 py-0.5 bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400 rounded-lg text-[10px] font-black">{kw}</span>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">"{rule.replyMessage}"</p>
                      </div>
                      <button onClick={() => handleDeleteRule(rule.id)} className="p-2 text-muted-foreground hover:text-red-500 transition-colors flex-shrink-0">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="border border-dashed border-border rounded-2xl p-6 space-y-4">
                <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Nova Regra</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black text-muted-foreground uppercase mb-1">ID do Post</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-xs font-bold text-foreground outline-none focus:ring-2 focus:ring-green-400"
                      value={newRule.mediaId}
                      onChange={e => setNewRule({ ...newRule, mediaId: e.target.value })}
                      placeholder="17841400000000000"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-muted-foreground uppercase mb-1">Rótulo (sua referência)</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-xs font-bold text-foreground outline-none focus:ring-2 focus:ring-green-400"
                      value={newRule.mediaLabel}
                      onChange={e => setNewRule({ ...newRule, mediaLabel: e.target.value })}
                      placeholder="Post evento 15/05"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-muted-foreground uppercase mb-1">Palavras-chave (separadas por vírgula)</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-xs font-bold text-foreground outline-none focus:ring-2 focus:ring-green-400"
                    value={newRule.keywords}
                    onChange={e => setNewRule({ ...newRule, keywords: e.target.value.toUpperCase() })}
                    placeholder="INSCREVER, PARTICIPAR"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-muted-foreground uppercase mb-1">Resposta automática</label>
                  <textarea
                    className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-xs font-bold text-foreground outline-none focus:ring-2 focus:ring-green-400 resize-none"
                    rows={2}
                    value={newRule.replyMessage}
                    onChange={e => setNewRule({ ...newRule, replyMessage: e.target.value })}
                    placeholder="Ótimo! Vou te enviar o link por DM."
                  />
                </div>
                <button
                  onClick={handleAddRule}
                  disabled={addingRule}
                  className="w-full py-3 bg-green-600 text-white rounded-xl text-xs font-black hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {addingRule ? 'Adicionando...' : '+ Adicionar Regra'}
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-8 py-3 bg-blue-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-900 shadow-lg shadow-blue-200 dark:shadow-blue-900/30 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              {saving ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

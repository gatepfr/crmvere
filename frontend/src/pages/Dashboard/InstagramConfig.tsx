import { useState, useEffect, useCallback } from 'react';
import api from '../../api/client';
import {
  Instagram, CheckCircle2, AlertCircle, RefreshCw,
  Settings2, Bot, MessageCircle, Plus, Trash2, ExternalLink, MessageSquare
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

export default function InstagramConfig() {
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
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
    } catch { setError('Falha ao carregar configurações.'); }
    finally { setFetching(false); }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get('/instagram/status');
      setStatus(res.data);
    } catch { setStatus({ connected: false }); }
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
    setLoading(true);
    setError(null);
    try {
      await api.post('/instagram/setup', {
        ...config,
        instagramCommentKeywords: JSON.stringify(config.instagramCommentKeywords),
        instagramDefaultQuickReplies: JSON.stringify(config.instagramDefaultQuickReplies),
      });
      await fetchStatus();
      alert('Configurações do Instagram salvas!');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Falha ao salvar.');
    } finally { setLoading(false); }
  };

  const addKeyword = () => {
    const kw = newKeyword.trim().toUpperCase();
    if (kw && !config.instagramCommentKeywords.includes(kw)) {
      setConfig(prev => ({ ...prev, instagramCommentKeywords: [...prev.instagramCommentKeywords, kw] }));
      setNewKeyword('');
    }
  };

  const removeKeyword = (kw: string) => {
    setConfig(prev => ({ ...prev, instagramCommentKeywords: prev.instagramCommentKeywords.filter(k => k !== kw) }));
  };

  const addDefaultQr = () => {
    const t = newQr.title.trim();
    const p = newQr.payload.trim().toUpperCase();
    if (t && p && config.instagramDefaultQuickReplies.length < 13) {
      setConfig(prev => ({ ...prev, instagramDefaultQuickReplies: [...prev.instagramDefaultQuickReplies, { title: t, payload: p }] }));
      setNewQr({ title: '', payload: '' });
    }
  };

  const removeDefaultQr = (idx: number) => {
    setConfig(prev => ({ ...prev, instagramDefaultQuickReplies: prev.instagramDefaultQuickReplies.filter((_, i) => i !== idx) }));
  };

  const handleAddRule = async () => {
    if (!newRule.mediaId || !newRule.mediaLabel || !newRule.keywords || !newRule.replyMessage) {
      alert('Preencha todos os campos da regra.');
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
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao adicionar regra.');
    } finally { setAddingRule(false); }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm('Excluir esta regra?')) return;
    await api.delete(`/instagram/comment-rules/${id}`);
    setRules(prev => prev.filter(r => r.id !== id));
  };

  const handleAddFlow = async () => {
    if (!newFlow.triggerPayload || !newFlow.responseMessage) {
      alert('Preencha payload e resposta.');
      return;
    }
    setAddingFlow(true);
    try {
      await api.post('/instagram/quick-reply-flows', newFlow);
      setNewFlow({ triggerPayload: '', responseMessage: '' });
      await fetchFlows();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao adicionar flow.');
    } finally { setAddingFlow(false); }
  };

  const handleDeleteFlow = async (id: string) => {
    if (!confirm('Excluir este flow?')) return;
    await api.delete(`/instagram/quick-reply-flows/${id}`);
    setQrFlows(prev => prev.filter(f => f.id !== id));
  };

  const generateVerifyToken = () => {
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    setConfig(prev => ({ ...prev, instagramWebhookVerifyToken: token }));
  };

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={e => onChange(e.target.checked)} />
      <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-500"></div>
    </label>
  );

  if (fetching) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw className="w-8 h-8 text-pink-500 animate-spin" />
    </div>
  );

  const backendUrl = (import.meta.env.VITE_API_URL || window.location.origin.replace(':5173', ':3001')).replace('/api', '');

  return (
    <div className="max-w-4xl space-y-8">
      <header>
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
          <Instagram className="text-pink-500" size={32} />
          Conexão Instagram
        </h2>
        <p className="text-slate-500">Configure DMs com IA, robô de comentários e regras por post.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">

          {/* Credentials */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-pink-500" /> Credenciais da Meta API
            </h3>
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Access Token (Page Token)</label>
              <input type="password" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-pink-400"
                value={config.instagramAccessToken} onChange={e => setConfig({ ...config, instagramAccessToken: e.target.value })} placeholder="EAAxxxxxxxxx..." />
              <p className="text-[10px] text-slate-400 mt-1">Meta for Developers → seu App → Instagram → Token de Acesso da Página.</p>
            </div>
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Verify Token (Webhook)</label>
              <div className="flex gap-2">
                <input type="text" className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-pink-400"
                  value={config.instagramWebhookVerifyToken} onChange={e => setConfig({ ...config, instagramWebhookVerifyToken: e.target.value })} placeholder="token-secreto" />
                <button onClick={generateVerifyToken} className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-600 whitespace-nowrap">Gerar</button>
              </div>
            </div>
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
              <p className="text-xs font-bold text-blue-800 mb-1">URL do Webhook (cole na Meta):</p>
              <code className="text-xs text-blue-600 break-all">{backendUrl}/api/webhook/instagram/SEU_TENANT_ID</code>
            </div>
          </div>

          {/* DMs */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-blue-500" /> DMs Recebidas
            </h3>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
              <div>
                <p className="text-sm font-bold text-slate-700">Cadastrar automaticamente no banco</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {config.instagramAutoCreateMunicipe
                    ? 'Quem mandar DM e não estiver no banco será cadastrado automaticamente.'
                    : 'Somente munícipes já cadastrados (via @handle) terão DMs processadas.'}
                </p>
              </div>
              <Toggle checked={config.instagramAutoCreateMunicipe} onChange={v => setConfig({ ...config, instagramAutoCreateMunicipe: v })} />
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
              <div>
                <p className="text-sm font-bold text-slate-700">Resposta automática por IA</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {config.instagramDmAiEnabled
                    ? 'IA responde automaticamente (igual ao WhatsApp).'
                    : 'DMs salvas no painel — equipe responde manualmente.'}
                </p>
              </div>
              <Toggle checked={config.instagramDmAiEnabled} onChange={v => setConfig({ ...config, instagramDmAiEnabled: v })} />
            </div>
          </div>

          {/* Quick Replies */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-500" /> Quick Replies (Botões nas DMs)
            </h3>
            <p className="text-[11px] text-slate-400">
              Botões exibidos ao final das respostas da IA. O usuário clica em vez de digitar. Limite: 13 botões, máximo 20 caracteres cada.
            </p>
            <div className="flex gap-2">
              <input type="text" className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-400"
                value={newQr.title} onChange={e => setNewQr({ ...newQr, title: e.target.value.slice(0, 20) })} placeholder="Texto do botão (máx 20)" />
              <input type="text" className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-400"
                value={newQr.payload} onChange={e => setNewQr({ ...newQr, payload: e.target.value.toUpperCase() })} placeholder="PAYLOAD" />
              <button onClick={addDefaultQr} className="p-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl"><Plus size={16} /></button>
            </div>
            <div className="flex flex-wrap gap-2">
              {config.instagramDefaultQuickReplies.map((qr, i) => (
                <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg text-xs font-black">
                  {qr.title} <span className="opacity-50 text-[9px]">{qr.payload}</span>
                  <button onClick={() => removeDefaultQr(i)} className="hover:text-red-500"><Trash2 size={11} /></button>
                </span>
              ))}
              {config.instagramDefaultQuickReplies.length === 0 && <p className="text-xs text-slate-400">Nenhum quick reply configurado.</p>}
            </div>

            {/* Quick Reply Flows */}
            {qrFlows.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Flows por Payload</p>
                {qrFlows.map(flow => (
                  <div key={flow.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-xs font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">{flow.triggerPayload}</span>
                      <p className="text-xs text-slate-600 mt-1">"{flow.responseMessage}"</p>
                    </div>
                    <button onClick={() => handleDeleteFlow(flow.id)} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}
            <div className="border border-dashed border-slate-300 rounded-xl p-4 space-y-3">
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Novo Flow</p>
              <div className="grid grid-cols-2 gap-3">
                <input type="text" className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-400"
                  value={newFlow.triggerPayload} onChange={e => setNewFlow({ ...newFlow, triggerPayload: e.target.value.toUpperCase() })} placeholder="PAYLOAD do botão" />
                <input type="text" className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-400"
                  value={newFlow.responseMessage} onChange={e => setNewFlow({ ...newFlow, responseMessage: e.target.value })} placeholder="Resposta automática" />
              </div>
              <button onClick={handleAddFlow} disabled={addingFlow} className="w-full py-2 bg-indigo-600 text-white rounded-lg text-xs font-black hover:bg-indigo-700 disabled:opacity-50">
                {addingFlow ? 'Adicionando...' : '+ Adicionar Flow'}
              </button>
            </div>
          </div>

          {/* Story Replies */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <Instagram className="w-4 h-4 text-pink-500" /> Respostas a Stories
            </h3>
            <p className="text-[11px] text-slate-400">Quando alguém menciona seu perfil ou responde seu Story, o bot envia DM automática.</p>
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Menção nos Stories (@conta)</label>
              <textarea className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-pink-400" rows={2}
                value={config.instagramStoryMentionReply} onChange={e => setConfig({ ...config, instagramStoryMentionReply: e.target.value })}
                placeholder="Oi! Vi que você nos mencionou nos Stories. Como posso ajudar?" />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Resposta ao Story</label>
              <textarea className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-pink-400" rows={2}
                value={config.instagramStoryReply} onChange={e => setConfig({ ...config, instagramStoryReply: e.target.value })}
                placeholder="Oi! Obrigado por responder nosso Story. Como posso ajudar?" />
            </div>
          </div>

          {/* Global comment bot */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Bot className="w-4 h-4 text-purple-500" /> Robô de Comentários (Global)
              </h3>
              <Toggle checked={config.instagramBotEnabled} onChange={v => setConfig({ ...config, instagramBotEnabled: v })} />
            </div>
            <p className="text-[11px] text-slate-400">Funciona em todos os posts. Se o comentário contiver a palavra-chave, o bot responde.</p>
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Palavras-chave</label>
              <div className="flex gap-2">
                <input type="text" className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-pink-400"
                  value={newKeyword} onChange={e => setNewKeyword(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && addKeyword()} placeholder="QUERO, INFO, AJUDA..." />
                <button onClick={addKeyword} className="p-2.5 bg-pink-500 hover:bg-pink-600 text-white rounded-xl"><Plus size={16} /></button>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {config.instagramCommentKeywords.map(kw => (
                  <span key={kw} className="flex items-center gap-1.5 px-3 py-1.5 bg-pink-50 border border-pink-200 text-pink-700 rounded-lg text-xs font-black">
                    {kw}
                    <button onClick={() => removeKeyword(kw)} className="hover:text-red-500"><Trash2 size={12} /></button>
                  </span>
                ))}
                {config.instagramCommentKeywords.length === 0 && <p className="text-xs text-slate-400">Nenhuma palavra-chave configurada.</p>}
              </div>
            </div>
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Resposta automática</label>
              <textarea className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-pink-400" rows={3}
                value={config.instagramCommentReply} onChange={e => setConfig({ ...config, instagramCommentReply: e.target.value })}
                placeholder="Obrigado pelo comentário! Em breve te mandamos uma DM." />
            </div>
          </div>

          {/* Per-post rules */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-green-500" /> Regras por Post Específico
            </h3>
            <p className="text-[11px] text-slate-400">Regras por post têm prioridade sobre as globais. Copie o ID do post no link do Instagram.</p>

            {rules.length > 0 && (
              <div className="space-y-3">
                {rules.map(rule => (
                  <div key={rule.id} className="flex items-start justify-between p-4 bg-slate-50 rounded-xl border border-slate-200 gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 text-sm truncate">{rule.mediaLabel}</p>
                      <p className="text-[10px] text-slate-400 font-mono truncate">ID: {rule.mediaId}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {(JSON.parse(rule.keywords) as string[]).map(kw => (
                          <span key={kw} className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-black">{kw}</span>
                        ))}
                      </div>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">"{rule.replyMessage}"</p>
                    </div>
                    <button onClick={() => handleDeleteRule(rule.id)} className="p-2 text-slate-400 hover:text-red-500 flex-shrink-0"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            )}

            <div className="border border-dashed border-slate-300 rounded-xl p-4 space-y-3">
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Nova Regra</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">ID do Post</label>
                  <input type="text" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-green-400"
                    value={newRule.mediaId} onChange={e => setNewRule({ ...newRule, mediaId: e.target.value })} placeholder="17841400000000000" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Rótulo (sua referência)</label>
                  <input type="text" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-green-400"
                    value={newRule.mediaLabel} onChange={e => setNewRule({ ...newRule, mediaLabel: e.target.value })} placeholder="Post evento 15/05" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Palavras-chave (separadas por vírgula)</label>
                <input type="text" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-green-400"
                  value={newRule.keywords} onChange={e => setNewRule({ ...newRule, keywords: e.target.value.toUpperCase() })} placeholder="INSCREVER, PARTICIPAR" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Resposta automática</label>
                <textarea className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-green-400" rows={2}
                  value={newRule.replyMessage} onChange={e => setNewRule({ ...newRule, replyMessage: e.target.value })} placeholder="Ótimo! Vou te enviar o link por DM." />
              </div>
              <button onClick={handleAddRule} disabled={addingRule} className="w-full py-2 bg-green-600 text-white rounded-lg text-xs font-black hover:bg-green-700 disabled:opacity-50">
                {addingRule ? 'Adicionando...' : '+ Adicionar Regra'}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-start gap-3 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" /><p>{error}</p>
            </div>
          )}

          <button onClick={handleSave} disabled={loading}
            className="w-full bg-pink-500 text-white py-3 rounded-xl font-black hover:bg-pink-600 transition-colors disabled:opacity-50 shadow-lg shadow-pink-200">
            {loading ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </div>

        {/* Status sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 flex flex-col items-center justify-center text-center min-h-[250px]">
            {status?.connected ? (
              <div className="space-y-4">
                <div className="w-20 h-20 bg-pink-50 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10 text-pink-500" />
                </div>
                <div>
                  <h4 className="text-xl font-black text-slate-900">Conectado!</h4>
                  <p className="text-slate-500 text-sm mt-1">@{status.username}</p>
                </div>
                <button onClick={fetchStatus} className="text-slate-400 hover:text-slate-600 flex items-center gap-2 text-xs font-semibold mx-auto mt-2">
                  <RefreshCw className="w-3 h-3" /> Verificar
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                  <Instagram className="w-10 h-10 text-slate-300" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-slate-700">Não conectado</h4>
                  <p className="text-slate-400 text-sm mt-1">{status?.error || 'Configure o Access Token.'}</p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
            <h4 className="font-black text-xs text-amber-800 uppercase tracking-widest">Passos para conectar</h4>
            <ol className="space-y-2 text-xs text-amber-700 font-bold list-decimal list-inside">
              <li>Crie um App em developers.facebook.com</li>
              <li>Adicione o produto "Instagram"</li>
              <li>Gere um Page Access Token longo</li>
              <li>Configure o Webhook com a URL acima</li>
              <li>Assine: <code>messages</code> e <code>comments</code></li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

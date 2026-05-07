import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Smartphone, CheckCircle2, AlertCircle, RefreshCw, Database, Trash2, QrCode as QrCodeIcon } from 'lucide-react';

interface WhatsAppStatus {
  state: string;
  status: string;
}

const formatPhoneBR = (value: string) => {
  const d = value.replace(/\D/g, '').slice(0, 13);
  if (d.length <= 2) return d.length ? `+${d}` : '';
  if (d.length <= 4) return `+${d.slice(0, 2)} (${d.slice(2)}`;
  if (d.length <= 9) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4)}`;
  if (d.length <= 13) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9, 13)}`;
};

export default function WhatsAppConfig() {
  const { user } = useAuth();
  const [config, setConfig] = useState({ 
    evolutionApiUrl: '', 
    evolutionGlobalToken: '',
    whatsappNotificationNumber: '' 
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [clickCount, setClickCount] = useState(0);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await api.get('/config/me');
      setConfig({
        evolutionApiUrl: res.data.evolutionApiUrl || '',
        evolutionGlobalToken: res.data.evolutionGlobalToken || '',
        whatsappNotificationNumber: formatPhoneBR(res.data.whatsappNotificationNumber || ''),
      });
      
      return res.data;
    } catch (err) {
      console.error('Erro ao carregar config:', err);
      setError('Falha ao carregar configurações do servidor.');
    } finally {
      setFetching(false);
    }
  }, []);

  const handleHeaderClick = () => {
    if (user?.role === 'super_admin') {
      const newCount = clickCount + 1;
      setClickCount(newCount);
      if (newCount === 5) {
        setShowConfig(true);
        setClickCount(0);
      }
    }
  };

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get('/whatsapp/instance/status');
      // Evolution API can return different formats based on version
      // Some return { instance: { state: 'open' } }, others { state: 'open' }
      const data = res.data.instance || res.data;
      setStatus(data);
      
      // If connected, clear QR code
      if (data.state === 'open' || data.status === 'CONNECTED') {
        setQrCode(null);
      }
    } catch (err: unknown) {
      console.error('Erro ao buscar status:', err);
      // If 400 it might mean instance doesn't exist
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosError = err as { response: { status: number } };
        if (axiosError.response?.status === 400) {
          setStatus(null);
        }
      }
    }
  }, []);

  const fetchQrCode = useCallback(async () => {
    try {
      const res = await api.get('/whatsapp/instance/qrcode');
      // Some versions return { base64: '...' }, others { code: '...' }
      if (res.data.base64) {
        setQrCode(res.data.base64);
      } else if (res.data.code) {
        setQrCode(res.data.code);
      }
    } catch (err: unknown) {
      console.error('Erro ao buscar QR Code:', err);
      // If instance not connected, Evolution API might return 404/400 for QR Code if it's already connected
    }
  }, []);

  useEffect(() => {
    fetchConfig().then(tenant => {
      // SÓ busca status se houver uma instância configurada no banco
      if (tenant?.evolutionApiUrl && tenant?.whatsappInstanceId) {
        fetchStatus();
      } else {
        // Se não tem instância, paramos o carregamento inicial
        setStatus(null);
      }
    });
  }, [fetchConfig, fetchStatus]);

  // Polling for status and QR code if not connected
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    
    // SÓ inicia o monitoramento se houver uma instância ativa para monitorar
    const hasInstance = config.evolutionApiUrl && status;
    const notConnected = status?.state !== 'open' && status?.status !== 'CONNECTED';

    if (hasInstance && notConnected) {
      fetchQrCode();
      interval = setInterval(() => {
        fetchStatus();
        fetchQrCode();
      }, 10000); // 10s
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [status, config.evolutionApiUrl, fetchStatus, fetchQrCode]);

  const handleSaveConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.post('/whatsapp/setup', config);
      toast.success('Configurações de conexão salvas!');
    } catch (err) {

      console.error('Erro ao salvar config:', err);
      setError('Falha ao salvar configurações.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInstance = async () => {
    setLoading(true);
    setError(null);
    setQrCode(null);
    try {
      const res = await api.post('/whatsapp/instance/create');
      console.log('Instância criada:', res.data);
      
      // Intensive polling for the first few seconds to get the QR code fast
      let attempts = 0;
      const interval = setInterval(async () => {
        await fetchStatus();
        await fetchQrCode();
        attempts++;
        if (attempts > 5) clearInterval(interval);
      }, 2000);
      
    } catch (err: any) {
      console.error('ERRO CRÍTICO NO WHATSAPP:', err);
      const errorMsg = err.response?.data?.error || err.response?.data?.message || 'Falha ao criar instância.';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!confirm('Deseja realmente desconectar este WhatsApp? Você precisará ler o QR Code novamente para conectar.')) return;
    
    setLoading(true);
    setError(null);
    try {
      await api.post('/whatsapp/instance/logout');
      setStatus(null);
      setQrCode(null);
      toast.success('WhatsApp desconectado com sucesso!');
    } catch (err) {
      console.error('Erro ao deslogar:', err);
      setError('Falha ao desconectar o WhatsApp.');
    } finally {
      setLoading(false);
    }
  };

  const isConnected = status?.state === 'open' || status?.status === 'CONNECTED';

  if (fetching) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  const isSuperAdmin = user?.role === 'super_admin';

  return (
    <div className="max-w-4xl space-y-8">
      <header onClick={handleHeaderClick} className="cursor-default">
        <h2 className="text-3xl font-extrabold text-foreground tracking-tight">Conexão WhatsApp</h2>
        <p className="text-muted-foreground">Integre o CRM diretamente com seu número de WhatsApp via Evolution API.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          {/* Seção: Número de Alerta (Visível para todos os Admins) */}
          <div className="bg-card rounded-2xl shadow-sm border border-border p-6 space-y-6">
            <h3 className="font-bold text-foreground flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              Notificações de Socorro
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-1 ml-1">WhatsApp da Equipe</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold text-foreground"
                  value={config.whatsappNotificationNumber}
                  onChange={e => setConfig({...config, whatsappNotificationNumber: formatPhoneBR(e.target.value)})}
                  placeholder="+55 (43) 99999-9999"
                />
                <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
                  Este número receberá um alerta imediato quando a IA solicitar intervenção humana.
                </p>
              </div>
              {!isSuperAdmin && (
                <button 
                  onClick={handleSaveConfig}
                  disabled={loading}
                  className="w-full bg-foreground text-background py-2.5 rounded-xl font-bold hover:bg-foreground/90 transition-colors disabled:opacity-50 text-xs shadow-sm"
                >
                  {loading ? 'Salvando...' : 'Salvar Número de Alerta'}
                </button>
              )}
            </div>
          </div>

          {/* Config Side - Visible for Super Admin OR if config is missing */}
          {(isSuperAdmin || showConfig) && (
            <div className="bg-card rounded-2xl shadow-sm border border-border p-6 space-y-6">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <Database className="w-4 h-4 text-blue-500" />
                Configuração de Servidor
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1">URL da API</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-foreground"
                    value={config.evolutionApiUrl}
                    onChange={e => setConfig({...config, evolutionApiUrl: e.target.value})}
                    placeholder="https://wa.crmvere.com.br"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1">Token Global</label>
                  <input
                    type="password"
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-foreground"
                    value={config.evolutionGlobalToken}
                    onChange={e => setConfig({...config, evolutionGlobalToken: e.target.value})}
                    placeholder="Token de Segurança"
                  />
                </div>
                <button 
                  onClick={handleSaveConfig}
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm shadow-md"
                >
                  {loading ? 'Salvando...' : 'Salvar Configurações'}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-start gap-3 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </div>

        {/* Status/QR Code Side */}
        <div className="lg:col-span-2">
          <div className="bg-card rounded-2xl shadow-sm border border-border p-8 min-h-[400px] flex flex-col items-center justify-center text-center">
            {isConnected ? (
              <div className="space-y-6">
                <div className="w-24 h-24 bg-green-50 dark:bg-green-950/30 rounded-full flex items-center justify-center mx-auto text-green-600 animate-pulse">
                  <CheckCircle2 className="w-12 h-12" />
                </div>
                <div>
                  <h4 className="text-2xl font-black text-foreground">Conectado com Sucesso!</h4>
                  <p className="text-muted-foreground mt-2">Seu WhatsApp está pronto para receber demandas.</p>
                </div>
                <div className="flex flex-col gap-2 pt-4">
                  <span className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-bold bg-green-100 dark:bg-green-950/50 text-green-700 mx-auto">
                    Status: {status?.state || status?.status}
                  </span>
                  <button
                    onClick={fetchStatus}
                    className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-xs font-semibold mx-auto mt-2 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Atualizar Status
                  </button>
                </div>
                <div className="pt-8 border-t border-border w-full max-w-xs">
                  <button
                    onClick={handleLogout}
                    disabled={loading}
                    className="text-red-500 hover:text-red-700 text-sm font-bold flex items-center gap-2 mx-auto transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Desconectar este WhatsApp
                  </button>
                </div>
              </div>
            ) : qrCode ? (
              <div className="space-y-6">
                <div className="bg-muted p-4 rounded-2xl border-2 border-dashed border-border inline-block">
                  {qrCode.startsWith('data:image') ? (
                    <img src={qrCode} alt="WhatsApp QR Code" className="w-64 h-64 rounded-lg shadow-sm" />
                  ) : (
                    <div className="w-64 h-64 flex flex-col items-center justify-center gap-2">
                       <QrCodeIcon className="w-12 h-12 text-muted-foreground/40" />
                       <p className="text-xs text-muted-foreground px-8">Carregando QR Code...</p>
                    </div>
                  )}
                </div>
                <div className="max-w-xs mx-auto">
                  <h4 className="text-xl font-bold text-foreground">Escaneie o QR Code</h4>
                  <p className="text-muted-foreground mt-2 text-sm">
                    Abra o WhatsApp no seu celular, vá em Aparelhos Conectados e escaneie o código acima.
                  </p>
                </div>
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-center gap-2 text-blue-600 font-bold text-sm">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Atualizando status...
                  </div>
                  <button 
                    onClick={handleLogout}
                    disabled={loading}
                    className="text-red-500 hover:text-red-700 text-sm font-bold flex items-center gap-2 mx-auto transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Cancelar e Reiniciar
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="w-20 h-20 bg-blue-50 dark:bg-blue-950/30 rounded-full flex items-center justify-center mx-auto text-blue-600">
                  <Smartphone className="w-10 h-10" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-foreground">Conectar WhatsApp</h4>
                  <p className="text-muted-foreground max-w-xs mx-auto mt-2">
                    Clique no botão abaixo para gerar um QR Code e vincular seu número.
                  </p>
                </div>
                <button 
                  onClick={handleCreateInstance}
                  disabled={loading}
                  className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50"
                >
                  {loading ? 'Preparando...' : 'Criar Instância Agora'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

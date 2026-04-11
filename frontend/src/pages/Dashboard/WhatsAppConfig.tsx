import { useState, useEffect, useCallback } from 'react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Smartphone, CheckCircle2, AlertCircle, RefreshCw, Database, QrCode as QrCodeIcon } from 'lucide-react';

interface WhatsAppStatus {
  state: string;
  status: string;
}

export default function WhatsAppConfig() {
  const { user } = useAuth();
  const [config, setConfig] = useState({ evolutionApiUrl: '', evolutionGlobalToken: '' });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await api.get('/config/me');
      setConfig({
        evolutionApiUrl: res.data.evolutionApiUrl || '',
        evolutionGlobalToken: res.data.evolutionGlobalToken || '',
      });
      return res.data;
    } catch (err) {
      console.error('Erro ao carregar config:', err);
      setError('Falha ao carregar configurações do servidor.');
    } finally {
      setFetching(false);
    }
  }, []);

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
      if (tenant?.evolutionApiUrl && tenant?.whatsappInstanceId) {
        fetchStatus();
      }
    });
  }, [fetchConfig, fetchStatus]);

  // Polling for status and QR code if not connected
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (status && status.state !== 'open' && status.status !== 'CONNECTED') {
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
      alert('Configurações de conexão salvas!');
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
      
      // Give it a moment then fetch status and qrcode
      setTimeout(() => {
        fetchStatus();
        fetchQrCode();
      }, 2000);
      
    } catch (err: unknown) {
      let errorMessage = 'Falha ao criar instância.';
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosError = err as { response: { data: { error?: string } } };
        errorMessage = axiosError.response?.data?.error || errorMessage;
      }
      setError(errorMessage);
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
      alert('WhatsApp desconectado com sucesso!');
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
      <header>
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Conexão WhatsApp</h2>
        <p className="text-slate-500">Integre o CRM diretamente com seu número de WhatsApp via Evolution API.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Config Side - Only visible for Super Admin */}
        {isSuperAdmin && (
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Database className="w-4 h-4 text-blue-500" />
                Servidor Evolution
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">API URL</label>
                  <input 
                    type="text" 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    value={config.evolutionApiUrl}
                    onChange={e => setConfig({...config, evolutionApiUrl: e.target.value})}
                    placeholder="https://api.seuservidor.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Global Token</label>
                  <input 
                    type="password" 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    value={config.evolutionGlobalToken}
                    onChange={e => setConfig({...config, evolutionGlobalToken: e.target.value})}
                    placeholder="Seu Global API Key"
                  />
                </div>
                <button 
                  onClick={handleSaveConfig}
                  disabled={loading}
                  className="w-full bg-slate-900 text-white py-2 rounded-lg font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50 text-sm"
                >
                  {loading ? 'Salvando...' : 'Salvar Servidor'}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-start gap-3 text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}
          </div>
        )}

        {/* Status/QR Code Side */}
        <div className={isSuperAdmin ? "lg:col-span-2" : "lg:col-span-3"}>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 min-h-[400px] flex flex-col items-center justify-center text-center">
            {(!status && (config.evolutionApiUrl || !isSuperAdmin)) ? (
              <div className="space-y-6">
                <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto text-blue-600">
                  <Smartphone className="w-10 h-10" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-slate-900">Instância não criada</h4>
                  <p className="text-slate-500 max-w-xs mx-auto mt-2">
                    Crie uma instância para gerar seu QR Code e começar a receber mensagens.
                  </p>
                </div>
                <button 
                  onClick={handleCreateInstance}
                  disabled={loading}
                  className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50"
                >
                  {loading ? 'Criando...' : 'Criar Instância Agora'}
                </button>
              </div>
            ) : isConnected ? (
              <div className="space-y-6">
                <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto text-green-600 animate-pulse">
                  <CheckCircle2 className="w-12 h-12" />
                </div>
                <div>
                  <h4 className="text-2xl font-black text-slate-900">Conectado com Sucesso!</h4>
                  <p className="text-slate-500 mt-2">Seu WhatsApp está pronto para receber demandas.</p>
                </div>
                <div className="flex flex-col gap-2 pt-4">
                  <span className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-bold bg-green-100 text-green-700 mx-auto">
                    Status: {status?.state || status?.status}
                  </span>
                  <button 
                    onClick={fetchStatus}
                    className="text-slate-400 hover:text-slate-600 flex items-center gap-2 text-xs font-semibold mx-auto mt-2 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Atualizar Status
                  </button>
                </div>
                <div className="pt-8 border-t border-slate-100 w-full max-w-xs">
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
                <div className="bg-slate-50 p-4 rounded-2xl border-2 border-dashed border-slate-200 inline-block">
                  {qrCode.startsWith('data:image') ? (
                    <img src={qrCode} alt="WhatsApp QR Code" className="w-64 h-64 rounded-lg shadow-sm" />
                  ) : (
                    <div className="w-64 h-64 flex flex-col items-center justify-center gap-2">
                       <QrCodeIcon className="w-12 h-12 text-slate-300" />
                       <p className="text-xs text-slate-400 px-8">Carregando QR Code base64...</p>
                    </div>
                  )}
                </div>
                <div className="max-w-xs mx-auto">
                  <h4 className="text-xl font-bold text-slate-900">Escaneie o QR Code</h4>
                  <p className="text-slate-500 mt-2 text-sm">
                    Abra o WhatsApp no seu celular, vá em Aparelhos Conectados e escaneie o código acima.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 text-blue-600 font-bold text-sm">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Atualizando status automaticamente...
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-400">
                  <Smartphone className="w-10 h-10" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-slate-900">Aguardando Credenciais</h4>
                  <p className="text-slate-500 max-w-xs mx-auto mt-2">
                    Configure a URL do servidor e o Token Global para iniciar a conexão.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Check } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setForgotMessage('');
    try {
      await api.post('/auth/forgot-password', { email: forgotEmail });
      setForgotMessage('E-mail enviado com sucesso! Verifique sua caixa de entrada (e a pasta de spam).');
      setIsSuccess(true);
    } catch (err) {
      setForgotMessage('Erro ao processar solicitação. Tente novamente.');
      setIsSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  const closeForgotModal = () => {
    setShowForgotModal(false);
    setForgotMessage('');
    setIsSuccess(false);
    setForgotEmail('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/auth/login', { email, password });
      const { token, user } = response.data;
      
      login(token, user);
      
      if (user.role === 'super_admin') {
        navigate('/superadmin');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login falhou. Verifique suas credenciais.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <img src="/logo_site.png" alt="CRM do Verê" className="h-16 w-auto mx-auto mb-4 object-contain" />
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Plataforma de Gestão Parlamentar</p>
        </div>
        
        {error && (
          <div className="p-3 text-sm text-red-700 bg-red-100 rounded-md">
            {error}
          </div>
        )}
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label htmlFor="email-address" className="sr-only">E-mail</label>
              <input
                id="email-address"
                name="email"
                type="email"
                required
                className="relative block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="E-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Senha</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="relative block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => setShowForgotModal(true)}
              className="text-xs font-bold text-blue-600 hover:text-blue-700"
            >
              Esqueci minha senha
            </button>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="relative flex justify-center w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md group hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </div>
        </form>
        <div className="mt-6 flex flex-col items-center gap-3">
          <a
            href="https://wa.me/5543984138841?text=Olá!%20Gostaria%20de%20solicitar%20um%20teste%20gratuito%20do%20CRM%20Vere."
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-semibold text-green-600 hover:text-green-700 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.117 1.528 5.848L.057 23.571a.75.75 0 0 0 .918.918l5.723-1.471A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.907 0-3.698-.5-5.254-1.375l-.376-.215-3.898 1.002 1.002-3.898-.215-.376A9.953 9.953 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
            </svg>
            Quero testar o CRM Vere
          </a>
          <a
            href="/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            Política de Privacidade
          </a>
        </div>
      </div>

      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm p-8 bg-white rounded-[2rem] shadow-2xl animate-in zoom-in duration-200">
            <h3 className="text-xl font-black text-slate-900 mb-2">Esqueci minha senha</h3>
            <p className="text-sm text-slate-500 mb-6 font-medium">
              {isSuccess 
                ? 'Quase lá! Siga as instruções enviadas para o seu e-mail.' 
                : 'Digite seu e-mail para receber um link de redefinição.'}
            </p>
            
            {!isSuccess ? (
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <input
                  type="email"
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm"
                  placeholder="seu@email.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                />
                
                {forgotMessage && (
                  <p className="text-xs font-bold text-red-500 bg-red-50 p-2 rounded-lg text-center">
                    {forgotMessage}
                  </p>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeForgotModal}
                    className="flex-1 px-4 py-3 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200"
                  >
                    CANCELAR
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-3 text-xs font-black text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 shadow-lg shadow-blue-200"
                  >
                    {loading ? 'ENVIANDO...' : 'ENVIAR LINK'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-6">
                <div className="bg-green-50 border border-green-100 p-4 rounded-2xl flex flex-col items-center gap-2">
                  <div className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center shadow-lg">
                    <Check size={20} strokeWidth={4} />
                  </div>
                  <p className="text-xs font-bold text-green-700 text-center leading-relaxed">
                    {forgotMessage}
                  </p>
                </div>
                <button
                  onClick={closeForgotModal}
                  className="w-full px-4 py-3 text-xs font-black text-white bg-slate-900 rounded-xl hover:bg-slate-800 shadow-xl"
                >
                  FECHAR E VOLTAR
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

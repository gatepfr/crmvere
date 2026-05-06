import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Check, Loader2, Users, Zap, Shield, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

const FEATURES = [
  { icon: Users, text: 'Gestão completa de munícipes e demandas' },
  { icon: Zap, text: 'Disparo em massa via WhatsApp' },
  { icon: BarChart3, text: 'Inteligência eleitoral e relatórios' },
  { icon: Shield, text: 'Dados seguros e controle de acesso' },
];

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token, user } = response.data;
      login(token, user);
      navigate(user.role === 'super_admin' ? '/superadmin' : '/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login falhou. Verifique suas credenciais.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotMessage('');
    try {
      await api.post('/auth/forgot-password', { email: forgotEmail });
      setForgotMessage('E-mail enviado! Verifique sua caixa de entrada e a pasta de spam.');
      setForgotSuccess(true);
    } catch {
      setForgotMessage('Erro ao processar solicitação. Tente novamente.');
      setForgotSuccess(false);
    } finally {
      setForgotLoading(false);
    }
  };

  const closeForgot = () => {
    setForgotOpen(false);
    setForgotEmail('');
    setForgotMessage('');
    setForgotSuccess(false);
  };

  const inputCls = "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:bg-white focus:border-slate-400 focus:ring-2 focus:ring-slate-200 transition-all placeholder:text-slate-400";

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 flex-col justify-between p-12 relative overflow-hidden">
        {/* Background texture */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_oklch(0.35_0.12_255)_0%,_transparent_60%)] opacity-60" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_oklch(0.25_0.08_255)_0%,_transparent_50%)] opacity-40" />

        <div className="relative z-10">
          <img src="/logo_site.png" alt="CRM do Verê" className="h-12 w-auto object-contain" />
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <h1 className="text-4xl font-black text-white leading-tight tracking-tight">
              Gestão parlamentar<br />
              <span className="text-slate-400">de verdade.</span>
            </h1>
            <p className="text-slate-400 mt-4 text-base leading-relaxed max-w-sm">
              Tudo que o seu gabinete precisa para atender melhor, se comunicar mais e vencer na eleição.
            </p>
          </div>

          <ul className="space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                  <Icon size={16} className="text-slate-300" />
                </div>
                <span className="text-sm text-slate-300 font-medium">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 flex flex-col gap-3">
          <a
            href="https://wa.me/5543984138841?text=Olá!%20Gostaria%20de%20solicitar%20um%20teste%20gratuito%20do%20CRM%20Vere."
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 shrink-0">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.117 1.528 5.848L.057 23.571a.75.75 0 0 0 .918.918l5.723-1.471A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.907 0-3.698-.5-5.254-1.375l-.376-.215-3.898 1.002 1.002-3.898-.215-.376A9.953 9.953 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
            </svg>
            Quero testar o CRM Vere gratuitamente
          </a>
          <div className="flex items-center gap-3">
            <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-xs text-slate-600 hover:text-slate-400 transition-colors">Privacidade</a>
            <span className="text-slate-700 text-xs">·</span>
            <a href="/terms-of-service" target="_blank" rel="noopener noreferrer" className="text-xs text-slate-600 hover:text-slate-400 transition-colors">Termos</a>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white">
        {/* Mobile logo */}
        <div className="lg:hidden mb-10">
          <img src="/logo_site.png" alt="CRM do Verê" className="h-12 w-auto object-contain mx-auto" />
        </div>

        <div className="w-full max-w-sm space-y-8">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Bem-vindo de volta</h2>
            <p className="text-sm text-slate-500 mt-1">Entre na sua conta para continuar</p>
          </div>

          {error && (
            <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl font-medium">
              {error}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-widest">E-mail</label>
              <input
                type="email"
                required
                autoComplete="email"
                className={inputCls}
                placeholder="seu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-widest">Senha</label>
              <input
                type="password"
                required
                autoComplete="current-password"
                className={inputCls}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setForgotOpen(true)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
              >
                Esqueci minha senha
              </button>
            </div>

            <Button type="submit" disabled={loading} className="w-full py-6 text-sm font-black rounded-xl">
              {loading ? <><Loader2 size={16} className="animate-spin" /> Entrando...</> : 'Entrar'}
            </Button>
          </form>

          {/* Mobile links */}
          <div className="lg:hidden flex flex-col items-center gap-3 pt-4 border-t border-slate-100">
            <a
              href="https://wa.me/5543984138841?text=Olá!%20Gostaria%20de%20solicitar%20um%20teste%20gratuito%20do%20CRM%20Vere."
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              Quero testar o CRM Vere
            </a>
            <div className="flex items-center gap-3">
              <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">Privacidade</a>
              <span className="text-slate-300 text-xs">·</span>
              <a href="/terms-of-service" target="_blank" rel="noopener noreferrer" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">Termos</a>
            </div>
          </div>
        </div>
      </div>

      {/* Forgot password dialog */}
      <Dialog open={forgotOpen} onOpenChange={(open) => { if (!open) closeForgot(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Esqueci minha senha</DialogTitle>
            <DialogDescription>
              {forgotSuccess
                ? 'Quase lá! Siga as instruções enviadas para o seu e-mail.'
                : 'Digite seu e-mail para receber um link de redefinição.'}
            </DialogDescription>
          </DialogHeader>

          {!forgotSuccess ? (
            <form onSubmit={handleForgotSubmit} className="space-y-4 pt-2">
              <input
                type="email"
                required
                className="w-full px-4 py-3 bg-muted border border-input rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-ring transition-all"
                placeholder="seu@email.com"
                value={forgotEmail}
                onChange={e => setForgotEmail(e.target.value)}
              />
              {forgotMessage && (
                <p className="text-xs font-medium text-destructive bg-destructive/10 p-2 rounded-lg text-center">
                  {forgotMessage}
                </p>
              )}
              <div className="flex gap-3">
                <Button type="button" variant="secondary" className="flex-1" onClick={closeForgot}>Cancelar</Button>
                <Button type="submit" disabled={forgotLoading} className="flex-1">
                  {forgotLoading ? <><Loader2 size={14} className="animate-spin" /> Enviando</> : 'Enviar link'}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex flex-col items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-sm">
                  <Check size={20} strokeWidth={3} />
                </div>
                <p className="text-xs font-medium text-emerald-700 text-center leading-relaxed">{forgotMessage}</p>
              </div>
              <Button className="w-full" onClick={closeForgot}>Fechar e voltar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

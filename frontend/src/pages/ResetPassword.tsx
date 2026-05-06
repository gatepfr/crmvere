import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const inputCls = "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:bg-white focus:border-slate-400 focus:ring-2 focus:ring-slate-200 transition-all placeholder:text-slate-400";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { setError('As senhas não coincidem.'); return; }
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Falha ao redefinir senha. O link pode ter expirado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 flex-col items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_oklch(0.35_0.12_255)_0%,_transparent_60%)] opacity-60" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_oklch(0.25_0.08_255)_0%,_transparent_50%)] opacity-40" />
        <div className="relative z-10 text-center space-y-6 max-w-xs">
          <img src="/logo_site.png" alt="CRM do Verê" className="h-14 w-auto object-contain mx-auto" />
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight">Redefinição de senha</h2>
            <p className="text-slate-400 mt-2 text-sm leading-relaxed">
              Crie uma nova senha segura para proteger sua conta.
            </p>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white">
        <div className="lg:hidden mb-10">
          <img src="/logo_site.png" alt="CRM do Verê" className="h-12 w-auto object-contain mx-auto" />
        </div>

        <div className="w-full max-w-sm space-y-8">
          {!token ? (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                <XCircle size={28} className="text-red-500" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900">Link inválido</h2>
                <p className="text-sm text-slate-500 mt-1">O token de redefinição não foi encontrado ou expirou.</p>
              </div>
              <Button variant="outline" onClick={() => navigate('/login')} className="w-full">
                Voltar para o login
              </Button>
            </div>
          ) : success ? (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 size={28} className="text-emerald-500" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900">Senha atualizada!</h2>
                <p className="text-sm text-slate-500 mt-1">Redirecionando para o login em instantes...</p>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                <Loader2 size={12} className="animate-spin" />
                Aguarde...
              </div>
            </div>
          ) : (
            <>
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Criar nova senha</h2>
                <p className="text-sm text-slate-500 mt-1">Escolha uma senha com pelo menos 6 caracteres</p>
              </div>

              {error && (
                <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl font-medium">
                  {error}
                </div>
              )}

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-widest">Nova senha</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className={inputCls}
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-widest">Confirmar senha</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className={inputCls}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                  />
                </div>

                <Button type="submit" disabled={loading} className="w-full py-6 text-sm font-black rounded-xl">
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Redefinindo...</> : 'Atualizar senha'}
                </Button>

                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="w-full text-xs font-medium text-slate-400 hover:text-slate-700 transition-colors py-1"
                >
                  Voltar para o login
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

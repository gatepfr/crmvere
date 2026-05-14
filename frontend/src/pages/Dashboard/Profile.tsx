import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  User,
  Lock,
  Mail,
  Shield,
  Loader2,
  CheckCircle2,
  Trash2,
  Users,
  UserPlus,
  Calendar,
  Settings as SettingsIcon,
  Plus,
  Link2,
  Copy,
  ExternalLink
} from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';

interface Member { id: string; email: string; role: 'super_admin' | 'admin' | 'vereador' | 'assessor'; createdAt: string; }

export default function Profile() {
  const { user } = useAuth();
  const isAdmin = user?.role !== 'assessor';

  // Perfil / Senha
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Slug público
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);

  useEffect(() => {
    api.get('/config/me').then(res => setTenantSlug(res.data.slug)).catch(() => {});
  }, []);

  const publicUrl = tenantSlug ? `${window.location.origin}/p/${tenantSlug}` : '';

  const handleCopyLink = () => {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl);
    toast.success('Link copiado!');
  };

  // Equipe
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [newMemberEmail, setNewEmail] = useState('');
  const [addingMember, setAdding] = useState(false);

  // TEAM LOGIC
  const fetchMembers = useCallback(async () => {
    setLoadingMembers(true);
    try {
      const response = await api.get('/team');
      setMembers(response.data);
    } catch (err) { console.error(err); } finally { setLoadingMembers(false); }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchMembers();
  }, [fetchMembers, isAdmin]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      await api.post('/team', { email: newMemberEmail });
      setNewEmail('');
      fetchMembers();
      setSuccess('Membro convidado!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) { toast.error(err.response?.data?.error || 'Erro ao convidar'); } finally { setAdding(false); }
  };

  const handleToggleAdmin = async (id: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'assessor' : 'admin';
    if (!confirm('Deseja alterar o cargo deste usuário?')) return;
    try {
      await api.patch(`/team/${id}/role`, { role: newRole });
      fetchMembers();
    } catch (err) { toast.error('Erro ao atualizar cargo'); }
  };

  const handleDeleteMember = async (id: string) => {
    if (!confirm('Remover este membro?')) return;
    try { await api.delete(`/team/${id}`); fetchMembers(); } catch (err) { toast.error('Erro ao remover'); }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { setError('As senhas não coincidem.'); return; }
    setLoading(true);
    try {
      await api.patch('/profile/password', { newPassword });
      setSuccess('Senha alterada!');
      setNewPassword(''); setConfirmPassword('');
    } catch (err: any) { setError('Erro ao alterar'); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight flex items-center gap-3">
            <SettingsIcon className="text-blue-600" size={32} />
            Configurações do Gabinete
          </h1>
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest mt-1">Gestão de Perfil e Equipe</p>
        </div>
        {success && (
          <div className="px-6 py-3 bg-emerald-50 text-emerald-600 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 border border-emerald-100 animate-in slide-in-from-top-4">
            <CheckCircle2 size={16}/> {success}
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* COLUNA ESQUERDA: PERFIL E SEGURANÇA */}
        <div className="xl:col-span-4 space-y-8">
          <section className="bg-card rounded-[2.5rem] p-8 shadow-sm border border-border flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-3xl bg-blue-600 flex items-center justify-center mb-4 shadow-xl shadow-blue-200">
              <User className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-xl font-black text-foreground truncate w-full uppercase tracking-tighter">{user?.email.split('@')[0]}</h2>
            <span className="px-3 py-1 bg-muted text-muted-foreground rounded-full text-[9px] font-black uppercase mt-2">{user?.role}</span>
            <div className="w-full pt-6 mt-6 border-t border-border flex flex-col gap-4 text-left">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Mail className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm font-bold truncate">{user?.email}</span>
              </div>
            </div>
          </section>

          <section className="bg-card rounded-[2.5rem] p-8 shadow-sm border border-border">
            <h3 className="text-lg font-black text-foreground uppercase tracking-tight flex items-center gap-2 mb-4">
              <Link2 size={20} className="text-blue-600" />
              Página Pública
            </h3>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">
              Compartilhe com os munícipes
            </p>
            {!tenantSlug ? (
              <div className="flex justify-center py-4"><Loader2 className="animate-spin text-blue-600" size={20} /></div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 bg-muted rounded-2xl px-4 py-3 border border-border">
                  <span className="flex-1 text-xs font-mono text-foreground truncate">{publicUrl}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopyLink}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-foreground text-background rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-foreground/90 transition-all"
                  >
                    <Copy size={14} /> Copiar Link
                  </button>
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all"
                  >
                    <ExternalLink size={14} /> Abrir
                  </a>
                </div>
              </div>
            )}
          </section>

          <section className="bg-card rounded-[2.5rem] p-8 shadow-sm border border-border">
            <h3 className="text-lg font-black text-foreground uppercase tracking-tight flex items-center gap-2 mb-6">
              <Lock size={20} className="text-blue-600" />
              Alterar Senha
            </h3>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <input type="password" placeholder="Nova Senha" className="w-full px-5 py-3.5 bg-muted border border-border rounded-2xl outline-none focus:bg-background focus:border-blue-200 font-bold text-sm transition-all text-foreground" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
              <input type="password" placeholder="Confirme a Senha" className="w-full px-5 py-3.5 bg-muted border border-border rounded-2xl outline-none focus:bg-background focus:border-blue-200 font-bold text-sm transition-all text-foreground" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
              {error && <p className="text-[10px] font-black text-red-500 uppercase ml-1">{error}</p>}
              <button disabled={loading} className="w-full py-4 bg-foreground text-background rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-foreground/90 transition-all shadow-lg">
                {loading ? 'PROCESSANDO...' : 'ATUALIZAR SENHA'}
              </button>
            </form>
          </section>
        </div>

        {/* COLUNA DIREITA: EQUIPE */}
        <div className="xl:col-span-8 space-y-8">
          {isAdmin && (
            <section className="bg-card rounded-[2.5rem] p-8 shadow-sm border border-border">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-xl font-black text-foreground uppercase tracking-tight flex items-center gap-2">
                    <Users className="text-blue-600" />
                    Membros da Equipe
                  </h2>
                  <p className="text-xs font-bold text-muted-foreground mt-1 uppercase tracking-widest">Gerencie o acesso do seu gabinete</p>
                </div>
              </div>

              <form onSubmit={handleAddMember} className="bg-muted/50 p-6 rounded-3xl border border-border mb-8 flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 space-y-2 w-full">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">E-mail do Assessor</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                    <input type="email" placeholder="assessor@exemplo.com" className="w-full pl-11 pr-4 py-3 bg-background border border-border rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 text-foreground" value={newMemberEmail} onChange={e => setNewEmail(e.target.value)} required />
                  </div>
                </div>
                <button disabled={addingMember} className="w-full md:w-auto px-8 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
                  {addingMember ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                  CONVIDAR
                </button>
              </form>

              <div className="space-y-3">
                {loadingMembers ? (
                  <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-blue-600" /></div>
                ) : (
                  members.map(member => (
                    <div key={member.id} className="p-4 bg-card border border-border rounded-2xl flex items-center justify-between group hover:border-blue-200 transition-all shadow-sm">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground font-black text-xs uppercase">{member.email[0]}</div>
                        <div>
                          <p className="font-bold text-foreground text-sm">{member.email}</p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className={`text-[9px] font-black uppercase ${member.role === 'admin' || member.role === 'vereador' ? 'text-amber-500' : 'text-muted-foreground'}`}>
                              {member.role}
                            </span>
                            <span className="text-[9px] text-muted-foreground/40 font-bold uppercase tracking-tighter flex items-center gap-1">
                              <Calendar size={10}/> {new Date(member.createdAt).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        {member.id !== user?.id && (
                          <>
                            <button onClick={() => handleToggleAdmin(member.id, member.role)} className={`p-2 rounded-xl transition-all ${member.role === 'admin' ? 'text-amber-500 bg-amber-50' : 'text-muted-foreground hover:text-blue-600 hover:bg-blue-50'}`} title="Alterar Acesso"><Shield size={16} /></button>
                            <button onClick={() => handleDeleteMember(member.id)} className="p-2 text-muted-foreground/40 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={16} /></button>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

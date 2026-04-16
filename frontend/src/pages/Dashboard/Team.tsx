import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Users, UserPlus, Trash2, Shield, Mail, Calendar, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';

interface Member {
  id: string;
  email: string;
  role: 'super_admin' | 'admin' | 'vereador' | 'assessor';
  createdAt: string;
}

export default function Team() {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const isAdmin = user?.role !== 'assessor';

  useEffect(() => {
    if (isAdmin) {
      fetchMembers();
    }
  }, [isAdmin]);

  if (!isAdmin) {
    return <Navigate to="/dashboard" />;
  }

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/team');
      setMembers(response.data);
      setError(null);
    } catch (err: unknown) {
      setError('Erro ao carregar membros da equipe.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) return;

    try {
      setAdding(true);
      setError(null);
      setSuccess(null);
      const response = await api.post('/team', { email: newEmail });
      setMembers([...members, response.data]);
      setNewEmail('');
      setSuccess('Membro adicionado com sucesso!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? (err as any).response?.data?.error || err.message : 'Erro ao adicionar membro.';
      setError(message);
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteMember = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja remover este membro?')) return;

    try {
      await api.delete(`/team/${id}`);
      setMembers(members.filter(m => m.id !== id));
      setSuccess('Membro removido com sucesso!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? (err as any).response?.data?.error || err.message : 'Erro ao remover membro.';
      setError(message);
    }
  };

  const handleToggleAdmin = async (id: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'assessor' : 'admin';
    const confirmMsg = newRole === 'admin' 
      ? 'Deseja dar controle total (Admin) a este usuário?' 
      : 'Deseja remover os privilégios de Admin deste usuário?';
      
    if (!window.confirm(confirmMsg)) return;

    try {
      await api.patch(`/team/${id}/role`, { role: newRole });
      setMembers(members.map(m => m.id === id ? { ...m, role: newRole as any } : m));
      setSuccess('Cargo atualizado com sucesso!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError('Erro ao atualizar cargo.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Gestão de Equipe</h1>
        <p className="text-slate-500 mt-2">Gerencie os assessores e membros do seu gabinete.</p>
      </div>

      {isAdmin && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 mb-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
            <UserPlus className="w-5 h-5 mr-2 text-blue-600" />
            Adicionar Novo Assessor
          </h2>
          <form onSubmit={handleAddMember} className="flex gap-4">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="email"
                placeholder="E-mail do novo assessor"
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              disabled={adding}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-medium transition-all flex items-center disabled:opacity-50"
            >
              {adding ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <UserPlus className="w-5 h-5 mr-2" />
              )}
              Convidar
            </button>
          </form>
          <p className="text-xs text-slate-400 mt-2 italic">* A senha padrão será 'assessor123'</p>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center text-red-700">
          <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center text-green-700">
          <CheckCircle2 className="w-5 h-5 mr-3 flex-shrink-0" />
          {success}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-bottom border-slate-200">
                <th className="px-6 py-4 text-sm font-semibold text-slate-900">Membro</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-900">Cargo</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-900">Entrou em</th>
                {isAdmin && <th className="px-6 py-4 text-sm font-semibold text-slate-900 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mr-3">
                        <Users className="w-5 h-5 text-slate-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{member.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <Shield className="w-4 h-4 mr-2 text-slate-400" />
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                        member.role === 'admin' || member.role === 'vereador' 
                          ? 'bg-blue-50 text-blue-700' 
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center text-sm text-slate-500">
                      <Calendar className="w-4 h-4 mr-2" />
                      {new Date(member.createdAt).toLocaleDateString('pt-BR')}
                    </div>
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end items-center gap-2">
                        {member.id !== user?.id ? (
                          <>
                            <button
                              onClick={() => handleToggleAdmin(member.id, member.role)}
                              className={`p-2 rounded-lg transition-all ${
                                member.role === 'admin' 
                                  ? 'text-amber-500 bg-amber-50 hover:bg-amber-100' 
                                  : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'
                              }`}
                              title={member.role === 'admin' ? 'Remover Admin' : 'Tornar Admin'}
                            >
                              <Shield className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleDeleteMember(member.id)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              title="Remover membro"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-slate-400 italic px-2">(Você)</span>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {members.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 4 : 3} className="px-6 py-10 text-center text-slate-500">
                    Nenhum membro encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

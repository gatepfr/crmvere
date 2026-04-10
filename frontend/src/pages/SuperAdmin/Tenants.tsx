import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export default function Tenants() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { logout } = useAuth();

  const loadTenants = async () => {
    try {
      const response = await api.get('/superadmin/tenants');
      setTenants(response.data);
    } catch (err) {
      setError('Falha ao carregar gabinetes.');
    }
  };

  useEffect(() => {
    loadTenants();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      await api.post('/superadmin/tenants', { name, slug });
      setName('');
      setSlug('');
      loadTenants();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Falha ao criar gabinete.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="px-4 py-4 mx-auto max-w-7xl flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-800">VereadorCRM - Super Admin</h1>
          <button onClick={logout} className="text-sm text-gray-600 hover:text-gray-900">Sair</button>
        </div>
      </nav>

      <main className="px-4 py-8 mx-auto max-w-7xl">
        <div className="md:grid md:grid-cols-3 md:gap-6">
          <div className="md:col-span-1">
            <h3 className="text-lg font-medium leading-6 text-gray-900">Novo Gabinete</h3>
            <p className="mt-1 text-sm text-gray-600">
              Cadastre um novo vereador/gabinete na plataforma.
            </p>
          </div>
          <div className="mt-5 md:mt-0 md:col-span-2">
            <form onSubmit={handleCreate}>
              <div className="shadow sm:rounded-md sm:overflow-hidden">
                <div className="px-4 py-5 bg-white space-y-6 sm:p-6">
                  {error && <div className="p-2 text-sm text-red-600 bg-red-50 rounded">{error}</div>}
                  <div className="grid grid-cols-6 gap-6">
                    <div className="col-span-6 sm:col-span-3">
                      <label className="block text-sm font-medium text-gray-700">Nome do Vereador</label>
                      <input
                        type="text"
                        required
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                    <div className="col-span-6 sm:col-span-3">
                      <label className="block text-sm font-medium text-gray-700">Slug (URL)</label>
                      <input
                        type="text"
                        required
                        placeholder="nome-vereador"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div className="px-4 py-3 bg-gray-50 text-right sm:px-6">
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {loading ? 'Criando...' : 'Criar Gabinete'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>

        <div className="mt-10">
          <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Gabinetes Ativos</h3>
          <div className="flex flex-col">
            <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
              <div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
                <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Slug</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {tenants.map((tenant) => (
                        <tr key={tenant.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{tenant.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">/{tenant.slug}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${tenant.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {tenant.active ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Key,
  CheckCircle,
  XCircle,
  Edit2,
  RefreshCw,
  AlertCircle,
  Search,
  Check,
} from 'lucide-react';
import { ApiService } from '../services/api.ts';
import { RoleItem, UserItem } from '../types/index.ts';
import { UserCreateModal } from '../components/UserCreateModal.tsx';
import { EditRolesModal } from '../components/EditRolesModal.tsx';
import { useAuth } from '../hooks/useAuth.tsx';

export const UsersManagementPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);

  const canCreate = hasPermission('users:create');
  const canUpdate = hasPermission('users:update');
  const canAssignRoles = hasPermission('users:roles');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [usersData, rolesData] = await Promise.all([
        ApiService.getUsers(),
        ApiService.getRoles(),
      ]);
      setUsers(usersData);
      setRoles(rolesData);
    } catch (err: any) {
      setError(err.message || 'Failed to load users and roles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleStatus = async (user: UserItem) => {
    if (!canUpdate) {
      setError('You do not have permission to update user status (requires users:update)');
      return;
    }

    try {
      setError(null);
      await ApiService.updateUserStatus(user.id, !user.is_active);
      setSuccessMessage(`User "${user.username}" status updated to ${!user.is_active ? 'active' : 'inactive'}`);
      setTimeout(() => setSuccessMessage(null), 4000);
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to update user status');
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.username.toLowerCase().includes(q) ||
      u.full_name.toLowerCase().includes(q) ||
      u.roles.some((r) => r.role_name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-indigo-400" />
              <h1 className="text-lg font-bold text-white">User & Role Administration</h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Manage factory accounts, role assignments, and authentication status stored in PostgreSQL
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              title="Refresh User List"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            </button>

            {canCreate && (
              <button
                onClick={() => setIsCreateOpen(true)}
                className="px-3.5 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors flex items-center space-x-1.5 shadow-sm cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Create New User</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-lg flex items-start space-x-2 text-xs text-rose-300">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-lg flex items-start space-x-2 text-xs text-emerald-300">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="flex items-center justify-between">
        <div className="relative w-full max-w-xs">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search username, name, or role..."
            className="w-full bg-slate-900 border border-slate-800 rounded-md pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
          />
        </div>
        <span className="text-xs text-slate-400 font-mono">
          Showing {filteredUsers.length} of {users.length} users
        </span>
      </div>

      {/* Users Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 text-slate-400 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">User Details</th>
                <th className="py-3 px-4">Assigned Roles</th>
                <th className="py-3 px-4">Account Status</th>
                <th className="py-3 px-4">Registered Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    <div className="inline-block w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mb-2" />
                    <p>Loading users from PostgreSQL...</p>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No users matching criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-850/50 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-slate-400">#{u.id}</td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white">{u.full_name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">@{u.username}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((r) => (
                          <span
                            key={r.id}
                            className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                              r.role_name === 'System Administrator'
                                ? 'bg-indigo-950/80 text-indigo-300 border-indigo-800'
                                : r.role_name === 'Factory Manager'
                                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                                : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                          >
                            {r.role_name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-medium border ${
                          u.is_active
                            ? 'bg-emerald-950 text-emerald-400 border-emerald-800/60'
                            : 'bg-rose-950 text-rose-400 border-rose-800/60'
                        }`}
                      >
                        {u.is_active ? (
                          <>
                            <CheckCircle className="w-3 h-3" />
                            <span>Active</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3" />
                            <span>Deactivated</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {canAssignRoles && (
                          <button
                            onClick={() => setEditingUser(u)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] flex items-center space-x-1 transition-colors cursor-pointer"
                            title="Edit User Roles"
                          >
                            <Edit2 className="w-3 h-3 text-indigo-400" />
                            <span>Roles</span>
                          </button>
                        )}

                        {canUpdate && (
                          <button
                            onClick={() => handleToggleStatus(u)}
                            className={`px-2 py-1 rounded text-[11px] border transition-colors cursor-pointer ${
                              u.is_active
                                ? 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border-rose-800/60'
                                : 'bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border-emerald-800/60'
                            }`}
                          >
                            {u.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Definitions & Matrix */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Shield className="w-4 h-4 text-indigo-400" />
          <h2 className="text-sm font-semibold text-white">Configured Roles & Permission Mappings</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {roles.map((role) => (
            <div key={role.id} className="p-4 rounded-lg bg-slate-950 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <h3 className="text-xs font-bold text-white">{role.role_name}</h3>
                  <span className="text-[10px] text-slate-500 font-mono">Role #{role.id}</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug mb-3">{role.description}</p>
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Backend Permissions ({role.permissions?.length || 0}):
                </p>
                <div className="flex flex-wrap gap-1">
                  {role.permissions?.map((p) => (
                    <span
                      key={p.id}
                      className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-slate-300"
                    >
                      {p.permission_key}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create User Modal */}
      <UserCreateModal
        roles={roles}
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => {
          setSuccessMessage('New user provisioned successfully');
          setTimeout(() => setSuccessMessage(null), 4000);
          fetchData();
        }}
      />

      {/* Edit Roles Modal */}
      {editingUser && (
        <EditRolesModal
          user={editingUser}
          roles={roles}
          isOpen={Boolean(editingUser)}
          onClose={() => setEditingUser(null)}
          onSuccess={() => {
            setSuccessMessage(`Roles updated for user "${editingUser.username}"`);
            setTimeout(() => setSuccessMessage(null), 4000);
            fetchData();
          }}
        />
      )}
    </div>
  );
};

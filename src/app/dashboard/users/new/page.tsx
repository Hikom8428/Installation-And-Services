"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

const emptyForm = { name: "", email: "", password: "", role: "DOER" };

function roleBadgeColor(role: string) {
  switch (role) {
    case "MASTER": return "bg-slate-900 text-white";
    case "ADMIN": return "bg-purple-100 text-purple-800";
    case "MANAGER": return "bg-blue-100 text-blue-800";
    default: return "bg-slate-100 text-slate-700";
  }
}

export default function ManageUsersPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [formModal, setFormModal] = useState<{ isOpen: boolean; mode: "create" | "edit"; userId: string | null }>({
    isOpen: false,
    mode: "create",
    userId: null,
  });
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);

  const isMaster = session?.user?.role === "MASTER";
  const isAdmin = session?.user?.role === "ADMIN";
  const isManager = session?.user?.role === "MANAGER";
  const canManageUsers = isMaster || isAdmin || isManager;

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (res.ok) setUsers(data);
    } catch (error) {
      console.error("Failed to fetch users", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canManageUsers) fetchUsers();
    else setLoading(false);
  }, [session]);

  // ADMIN cannot manage MASTER/ADMIN accounts, MANAGER can only manage DOER
  // accounts (mirrors the server-side rules)
  const canEditTarget = (u: UserRow) =>
    isMaster || (isAdmin && (u.role === "MANAGER" || u.role === "DOER")) || (isManager && u.role === "DOER");

  const openCreateModal = () => {
    setFormData(emptyForm);
    setFormModal({ isOpen: true, mode: "create", userId: null });
  };

  const openEditModal = (u: UserRow) => {
    setFormData({ name: u.name, email: u.email, password: "", role: u.role });
    setFormModal({ isOpen: true, mode: "edit", userId: u.id });
  };

  const closeModal = () => setFormModal({ isOpen: false, mode: "create", userId: null });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const isEdit = formModal.mode === "edit";
      const url = isEdit ? `/api/users/${formModal.userId}` : "/api/users";
      const method = isEdit ? "PATCH" : "POST";

      // Don't send an empty password on edit — server keeps the existing one
      const payload: Record<string, string> = { name: formData.name, email: formData.email, role: formData.role };
      if (!isEdit || formData.password) payload.password = formData.password;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage(isEdit ? "User updated successfully!" : "User created successfully!");
        closeModal();
        fetchUsers();
      } else {
        setMessage(data.message || "Something went wrong");
      }
    } catch (error) {
      setMessage("An error occurred");
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(""), 5000);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/users/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setMessage("User deleted.");
        fetchUsers();
      } else {
        setMessage(data.message || "Failed to delete user");
      }
    } catch (error) {
      setMessage("An error occurred");
    } finally {
      setDeleteTarget(null);
      setTimeout(() => setMessage(""), 5000);
    }
  };

  if (!canManageUsers) {
    return <div className="p-4 text-red-500">Access Denied. Only Master, Admin, and Manager can manage users.</div>;
  }

  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Manage Users</h1>
          <p className="text-sm text-slate-500 mt-1">
            {isManager ? "Create, edit, or remove Doer accounts" : "Create, edit, or remove Manager and Doer accounts"}
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add New User
        </button>
      </div>

      {message && (
        <div className="p-4 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-sm font-medium">
          {message}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Created</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">No users found.</td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{u.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{u.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 inline-flex text-xs font-semibold rounded-full ${roleBadgeColor(u.role)}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {canEditTarget(u) ? (
                        <div className="flex items-center gap-3">
                          <button onClick={() => openEditModal(u)} className="text-indigo-600 hover:text-indigo-900 flex items-center gap-1">
                            <Pencil className="w-4 h-4" /> Edit
                          </button>
                          {u.id !== session?.user.id && (
                            <button onClick={() => setDeleteTarget(u)} className="text-red-600 hover:text-red-900 flex items-center gap-1">
                              <Trash2 className="w-4 h-4" /> Delete
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {formModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/50 overflow-y-auto h-full w-full flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md">
            <h3 className="text-lg font-bold mb-4 text-slate-900">
              {formModal.mode === "edit" ? "Edit User" : "Create New User"}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Password {formModal.mode === "edit" && <span className="text-slate-400 font-normal">(leave blank to keep unchanged)</span>}
                </label>
                <input
                  type="password"
                  required={formModal.mode === "create"}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                <select
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                >
                  <option value="DOER">Doer (Technician)</option>
                  {!isManager && <option value="MANAGER">Manager</option>}
                  {isMaster && <option value="ADMIN">Admin</option>}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 bg-slate-100 text-slate-700 p-2.5 rounded-lg text-sm font-medium hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-blue-600 text-white p-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? "Saving..." : formModal.mode === "edit" ? "Save Changes" : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-slate-900/50 overflow-y-auto h-full w-full flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-sm">
            <h3 className="text-lg font-bold mb-2 text-slate-900">Delete User</h3>
            <p className="text-sm text-slate-500 mb-4">
              Are you sure you want to delete <span className="font-semibold text-slate-700">{deleteTarget.name}</span>? This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 bg-slate-100 text-slate-700 p-2.5 rounded-lg text-sm font-medium hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 bg-red-600 text-white p-2.5 rounded-lg text-sm font-medium hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

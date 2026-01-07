import { useState, useEffect, useCallback } from 'react';
import { Users, Settings, ScrollText, UserPlus, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../utils/api';
import { PERMISSIONS_LIST } from '../utils/constants';
import { Layout } from '../components/layout';
import { Card, Button, Badge, Modal, InputField, SelectField } from '../components/ui';

export function Admin() {
  const { user, hasPerm } = useAuth();
  const [activeTab, setActiveTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [grades, setGrades] = useState([]);
  const [logs, setLogs] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [gradeModal, setGradeModal] = useState(false);
  const [editingGrade, setEditingGrade] = useState(null);
  const [gradeForm, setGradeForm] = useState({ name: "", color: "", permissions: {} });

  const [form, setForm] = useState({ 
    username: "", password: "", first_name: "", last_name: "", 
    badge_number: "", grade_id: "", visible_grade_id: "" 
  });

  const load = useCallback(() => {
    if(activeTab === "users" && hasPerm("manage_users")) {
      apiFetch("/api/admin/users").then(r => r && r.ok ? r.json() : []).then(setUsers);
    }
    if(activeTab === "grades") {
      apiFetch("/api/admin/grades").then(r => r && r.ok ? r.json() : []).then(setGrades);
    }
    if(activeTab === "logs" && hasPerm("view_logs")) {
      apiFetch("/api/admin/logs?limit=100").then(r => r && r.ok ? r.json() : []).then(setLogs);
    }
    apiFetch("/api/admin/grades").then(r => r && r.ok ? r.json() : []).then(setGrades);
  }, [activeTab, hasPerm]);

  useEffect(() => { load(); }, [load]);

  const openCreateModal = () => {
    setForm({ username: "", password: "", first_name: "", last_name: "", badge_number: "", grade_id: "", visible_grade_id: "" });
    setIsEditing(false);
    setEditingId(null);
    setShowModal(true);
  };

  const openEditModal = (u) => {
    setForm({ 
      username: u.username, 
      password: "", 
      first_name: u.first_name, 
      last_name: u.last_name, 
      badge_number: u.badge_number, 
      grade_id: u.grade_id, 
      visible_grade_id: u.visible_grade_id || "" 
    });
    setIsEditing(true);
    setEditingId(u.id);
    setShowModal(true);
  };

  const submitUser = async (e) => {
    e.preventDefault();
    const method = isEditing ? "PUT" : "POST";
    const url = isEditing ? "/api/admin/users/" + editingId : "/api/admin/users";
    const res = await apiFetch(url, { method, body: JSON.stringify(form) });
    
    if (res && res.ok) {
      setShowModal(false);
      load();
    } else {
      const err = res ? await res.json() : {};
      alert(err.error || "Erreur");
    }
  };
  
  const deleteUser = async (id) => {
    if (!hasPerm("delete_users")) return;
    if(window.confirm("Renvoyer définitivement cet officier ?")) {
      await apiFetch("/api/admin/users/" + id, { method: "DELETE" });
      load();
    }
  };

  const editGrade = (g) => {
    if (!hasPerm("manage_grades")) return;
    setEditingGrade(g);
    setGradeForm({ name: g.name, color: g.color, permissions: g.permissions || {} });
    setGradeModal(true);
  };

  const saveGrade = async (e) => {
    e.preventDefault();
    const res = await apiFetch("/api/admin/grades/" + editingGrade.id, { method: "PUT", body: JSON.stringify(gradeForm) });
    if (res && res.ok) {
      setGradeModal(false);
      load();
    }
  };

  const togglePerm = (permKey) => {
    const newPerms = {...gradeForm.permissions};
    newPerms[permKey] = !newPerms[permKey];
    setGradeForm({...gradeForm, permissions: newPerms});
  };

  const allTabs = [
    { id: "users", label: "Utilisateurs", icon: Users, perm: "manage_users" },
    { id: "grades", label: "Grades", icon: Settings, perm: "manage_grades" },
    { id: "logs", label: "Logs", icon: ScrollText, perm: "view_logs" },
  ];
  const tabs = allTabs.filter(t => hasPerm(t.perm));

  useEffect(() => {
    if (tabs.length > 0 && !tabs.find(t => t.id === activeTab)) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs, activeTab]);

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Administration</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200 dark:border-slate-700">
        {tabs.map(t => (
          <button 
            key={t.id} 
            onClick={() => setActiveTab(t.id)} 
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === t.id 
                ? "border-blue-600 text-blue-600" 
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <t.icon size={16}/> {t.label}
          </button>
        ))}
      </div>

      <Card noPadding className="overflow-hidden">
        {/* Users Tab */}
        {activeTab === "users" && hasPerm("manage_users") && (
          <>
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-end">
              <Button onClick={openCreateModal} className="flex items-center gap-2">
                <UserPlus size={16}/> Ajouter
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase font-medium text-slate-500">
                  <tr>
                    <th className="px-5 py-3 text-left">Officier</th>
                    <th className="px-5 py-3 text-left">Grade</th>
                    <th className="px-5 py-3 text-left">Matricule</th>
                    <th className="px-5 py-3 text-left">Statut</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {users.map(u => (
                    <tr key={u.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 ${!u.is_active ? "opacity-50" : ""}`}>
                      <td className="px-5 py-3 font-medium text-slate-800 dark:text-white">
                        {u.first_name} {u.last_name}
                      </td>
                      <td className="px-5 py-3">
                        <span 
                          className="px-2 py-1 rounded text-xs font-medium"
                          style={{backgroundColor: u.grade_color + "15", color: u.grade_color}}
                        >
                          {u.grade_name}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-mono text-slate-500">{u.badge_number}</td>
                      <td className="px-5 py-3">
                        <Badge variant={u.is_active ? "success" : "danger"}>
                          {u.is_active ? "Actif" : "Inactif"}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => openEditModal(u)} className="p-2 text-slate-400 hover:text-blue-500 rounded">
                            <Pencil size={16} />
                          </button>
                          {user && u.id !== user.id && hasPerm("delete_users") && (
                            <button onClick={() => deleteUser(u.id)} className="p-2 text-slate-400 hover:text-red-500 rounded">
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        
        {/* Grades Tab */}
        {activeTab === "grades" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase font-medium text-slate-500">
                <tr>
                  <th className="px-5 py-3 text-left">Grade</th>
                  <th className="px-5 py-3 text-left">Niveau</th>
                  <th className="px-5 py-3 text-left">Permissions</th>
                  {hasPerm("manage_grades") && <th className="px-5 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {grades.map(g => (
                  <tr key={g.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-5 py-3 font-medium flex items-center gap-3">
                      <div className="w-3 h-3 rounded" style={{background: g.color}}></div>
                      <span className="text-slate-800 dark:text-white">{g.name}</span>
                    </td>
                    <td className="px-5 py-3 font-mono text-slate-500">{g.level}</td>
                    <td className="px-5 py-3 text-slate-500 text-xs">
                      {Object.keys(g.permissions || {}).filter(k => g.permissions[k]).length} / {PERMISSIONS_LIST.length}
                    </td>
                    {hasPerm("manage_grades") && (
                      <td className="px-5 py-3 text-right">
                        <Button variant="secondary" size="sm" onClick={() => editGrade(g)}>
                          Configurer
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === "logs" && hasPerm("view_logs") && (
          <div className="max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase font-medium text-slate-500 sticky top-0">
                <tr>
                  <th className="px-5 py-3 text-left">Date</th>
                  <th className="px-5 py-3 text-left">Utilisateur</th>
                  <th className="px-5 py-3 text-left">Action</th>
                  <th className="px-5 py-3 text-left">Détails</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {logs.map((l, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-5 py-3 text-slate-500 whitespace-nowrap text-xs">
                      {new Date(l.created_at).toLocaleString("fr-FR")}
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-800 dark:text-white text-sm">
                      {l.first_name} {l.last_name}
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={
                        l.action && l.action.includes("DELETE") ? "danger" :
                        l.action && l.action.includes("CREATE") ? "success" : "default"
                      }>
                        {l.action}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-slate-500 max-w-xs truncate text-xs">{l.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* User Modal */}
      {showModal && (
        <Modal 
          title={isEditing ? "Modifier Officier" : "Nouvel Officier"} 
          onClose={() => setShowModal(false)}
          size="lg"
        >
          <form onSubmit={submitUser} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Prénom" value={form.first_name} onChange={(e) => setForm({...form, first_name: e.target.value})} required />
              <InputField label="Nom" value={form.last_name} onChange={(e) => setForm({...form, last_name: e.target.value})} required />
            </div>
            <InputField label="Identifiant" value={form.username} onChange={(e) => setForm({...form, username: e.target.value})} required disabled={isEditing} />
            <InputField 
              label={isEditing ? "Nouveau mot de passe" : "Mot de passe"} 
              type="password" 
              placeholder={isEditing ? "Laisser vide si inchangé" : ""}
              value={form.password} 
              onChange={(e) => setForm({...form, password: e.target.value})} 
              required={!isEditing} 
            />
            <InputField label="Matricule" value={form.badge_number} onChange={(e) => setForm({...form, badge_number: e.target.value})} />
            <SelectField label="Grade" value={form.grade_id} onChange={(e) => setForm({...form, grade_id: e.target.value})} required>
              <option value="">Sélectionner un grade</option>
              {grades.map(g => <option key={g.id} value={g.id}>{g.name} (Niveau {g.level})</option>)}
            </SelectField>
            <SelectField label="Grade Visible (optionnel)" value={form.visible_grade_id} onChange={(e) => setForm({...form, visible_grade_id: e.target.value})}>
              <option value="">-- Utiliser le vrai grade --</option>
              {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </SelectField>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="flex-1">
                Annuler
              </Button>
              <Button type="submit" className="flex-1">
                {isEditing ? "Enregistrer" : "Créer"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Grade Modal */}
      {gradeModal && editingGrade && (
        <Modal 
          title={"Configuration: " + editingGrade.name} 
          onClose={() => setGradeModal(false)}
          size="lg"
        >
          <form onSubmit={saveGrade} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Nom du Grade" value={gradeForm.name} onChange={(e) => setGradeForm({...gradeForm, name: e.target.value})} />
              <div className="mb-4">
                <label className="block text-xs font-semibold uppercase tracking-wide mb-2 text-slate-600 dark:text-slate-400">Couleur</label>
                <input 
                  type="color" 
                  className="w-full h-10 rounded cursor-pointer border border-slate-300 dark:border-slate-600" 
                  value={gradeForm.color} 
                  onChange={(e) => setGradeForm({...gradeForm, color: e.target.value})} 
                />
              </div>
            </div>
            
            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Permissions</p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {PERMISSIONS_LIST.map(p => (
                  <label 
                    key={p.key} 
                    className="flex items-start gap-3 p-3 rounded hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-600 transition-colors"
                  >
                    <input 
                      type="checkbox" 
                      checked={gradeForm.permissions[p.key] || false} 
                      onChange={() => togglePerm(p.key)}
                      className="w-4 h-4 mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{p.label}</span>
                      <p className="text-xs text-slate-500">{p.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="secondary" onClick={() => setGradeModal(false)} className="flex-1">
                Annuler
              </Button>
              <Button type="submit" className="flex-1">Sauvegarder</Button>
            </div>
          </form>
        </Modal>
      )}
    </Layout>
  );
}

export default Admin;

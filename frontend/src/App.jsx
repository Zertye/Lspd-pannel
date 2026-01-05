import { BrowserRouter, Routes, Route, Navigate, useLocation, Link, useNavigate } from "react-router-dom"
import { createContext, useContext, useState, useEffect, useRef } from "react"
import { 
  Shield, Users, ClipboardList, ShieldAlert, LogOut, LayoutDashboard, Menu, X, 
  CheckCircle, Send, Phone, Sun, Moon, Lock, AlertTriangle, FileText, Activity,
  BarChart3, ScrollText, RefreshCw, ChevronRight, UserPlus, User, Camera, Pencil, Trash2
} from "lucide-react"

// --- Theme Context ---
const ThemeContext = createContext(null)
export function useTheme() { return useContext(ThemeContext) }

function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('theme')) return localStorage.getItem('theme')
    return 'dark'
  })
  useEffect(() => {
    const root = window.document.documentElement
    if (theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
    localStorage.setItem('theme', theme)
  }, [theme])
  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
}

// --- Auth Context ---
const AuthContext = createContext(null)
export function useAuth() { return useContext(AuthContext) }
const TOKEN_KEY = "lspd_auth_token";

export const apiFetch = async (url, options = {}) => {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = { ...options.headers };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
  return await fetch(url, { ...options, headers });
};

function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchUser = async () => {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) { setUser(null); setLoading(false); return null; }
      const r = await apiFetch("/api/auth/me");
      if (r.ok) {
        const d = await r.json();
        setUser(d.user);
      } else {
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
      }
    } catch (e) { setUser(null); }
    setLoading(false);
  }
  useEffect(() => { fetchUser() }, [])

  const login = async (username, password) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (data.success && data.token) {
        localStorage.setItem(TOKEN_KEY, data.token);
        setUser(data.user);
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch (e) { return { success: false, error: "Erreur connexion" }; }
  }
  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    window.location.href = "/";
  }
  
  // refreshUser exposé pour mettre à jour l'UI après modif profil
  const hasPerm = (perm) => user?.grade_level === 99 || user?.is_admin || user?.grade_permissions?.[perm] === true;

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasPerm, refreshUser: fetchUser }}>
      {children}
    </AuthContext.Provider>
  )
}

// --- UI Components ---
const InputField = ({ label, ...props }) => (
  <div className="mb-3">
    {label && <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-slate-500 dark:text-slate-400">{label}</label>}
    <input className="w-full px-3 py-2.5 text-sm rounded-md bg-slate-100 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 focus:border-blue-500 outline-none transition-all text-slate-800 dark:text-white" {...props} />
  </div>
)
const SelectField = ({ label, children, ...props }) => (
  <div className="mb-3">
    {label && <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-slate-500 dark:text-slate-400">{label}</label>}
    <select className="w-full px-3 py-2.5 text-sm rounded-md bg-slate-100 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 focus:border-blue-500 outline-none transition-all text-slate-800 dark:text-white appearance-none cursor-pointer" {...props}>{children}</select>
  </div>
)
const TextArea = ({ label, ...props }) => (
  <div className="mb-3">
    {label && <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-slate-500 dark:text-slate-400">{label}</label>}
    <textarea className="w-full px-3 py-2.5 text-sm rounded-md bg-slate-100 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 focus:border-blue-500 outline-none transition-all text-slate-800 dark:text-white min-h-[100px] resize-none" {...props} />
  </div>
)

const StatCard = ({ label, value, icon: Icon, color = "blue" }) => {
    const colors = {
      blue: { icon: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-900/30", border: "border-blue-600" },
      green: { icon: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-900/30", border: "border-emerald-600" },
      yellow: { icon: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/30", border: "border-amber-600" },
      red: { icon: "text-red-600", bg: "bg-red-100 dark:bg-red-900/30", border: "border-red-600" },
    }
    const c = colors[color] || colors.blue;
    return (
      <div className={`bg-white dark:bg-slate-800 p-6 rounded-xl border-l-4 ${c.border} shadow-sm`}>
         <div className="flex justify-between items-start">
            <div>
               <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
               <p className="text-3xl font-black text-slate-800 dark:text-white">{value}</p>
            </div>
            <div className={`p-3 rounded-lg ${c.bg} ${c.icon}`}><Icon size={24}/></div>
         </div>
      </div>
    )
}

function SidebarItem({ icon: Icon, label, to, active }) {
  return (
    <Link to={to} className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all ${active ? "bg-blue-600 text-white shadow-lg shadow-blue-900/50" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}>
      <Icon size={18} />
      <span>{label}</span>
    </Link>
  )
}

function Layout({ children }) {
  const { user, logout, hasPerm, refreshUser } = useAuth()
  const location = useLocation()
  const [mobileMenu, setMobileMenu] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  
  // État pour le formulaire de profil
  const [profileForm, setProfileForm] = useState({ first_name: "", last_name: "", phone: "", password: "", profile_picture: null })
  const fileInputRef = useRef(null)

  // Ouvrir la modale profil avec les données actuelles
  const openProfile = () => {
      setProfileForm({
          first_name: user.first_name || "",
          last_name: user.last_name || "",
          phone: user.phone || "",
          password: "",
          profile_picture: null
      })
      setShowProfile(true)
  }

  // Sauvegarder le profil
  const saveProfile = async (e) => {
      e.preventDefault()
      const formData = new FormData()
      formData.append("first_name", profileForm.first_name)
      formData.append("last_name", profileForm.last_name)
      formData.append("phone", profileForm.phone)
      if (profileForm.password) formData.append("password", profileForm.password)
      if (profileForm.profile_picture instanceof File) formData.append("profile_picture", profileForm.profile_picture)
      
      const res = await apiFetch("/api/users/me", { method: "PUT", body: formData })
      if(res.ok) {
          await refreshUser() // Rafraîchir les données utilisateur globales
          setShowProfile(false)
      } else {
          alert("Erreur lors de la mise à jour")
      }
  }

  const navs = [
    { icon: LayoutDashboard, label: "Dashboard", to: "/dashboard" },
    { icon: ClipboardList, label: "Plaintes", to: "/plaintes" },
    { icon: Users, label: "Effectif LSPD", to: "/roster" },
  ]
  if (hasPerm('manage_users')) navs.push({ icon: ShieldAlert, label: "Administration", to: "/admin" })

  return (
    <div className="min-h-screen flex bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-sans">
      <aside className="hidden lg:flex flex-col w-64 bg-slate-900 border-r border-slate-800 fixed h-full z-30">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <Shield className="text-blue-600" size={32} />
          <div>
            <h1 className="text-white font-black text-lg tracking-tight">L.S.P.D</h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">MDT System</p>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navs.map(n => (
            <SidebarItem key={n.to} {...n} active={location.pathname === n.to} />
          ))}
        </nav>
        
        {/* SECTION PROFIL UTILISATEUR EN BAS */}
        <div className="p-4 bg-slate-950 border-t border-slate-800">
          <button onClick={openProfile} className="flex items-center gap-3 mb-3 w-full text-left hover:bg-slate-900 p-2 rounded-lg transition-colors group">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-white border-2 border-slate-700 overflow-hidden">
              {user?.profile_picture ? <img src={user.profile_picture} className="w-full h-full object-cover"/> : user?.first_name?.[0]}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-white truncate group-hover:text-blue-400 transition-colors">{user?.grade_name}</p>
              <p className="text-xs text-slate-500 truncate">{user?.last_name} {user?.first_name}</p>
            </div>
          </button>
          <button onClick={logout} className="w-full flex items-center justify-center gap-2 py-2 rounded-md bg-red-900/20 text-red-400 hover:bg-red-900/40 text-xs font-bold uppercase tracking-wider transition-all">
            <LogOut size={14} /> Déconnexion
          </button>
        </div>
      </aside>

      <main className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        <header className="lg:hidden h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 sticky top-0 z-20">
          <div className="flex items-center gap-2">
             <Shield className="text-blue-600" size={24} />
             <span className="font-bold text-white">LSPD MDT</span>
          </div>
          <button onClick={() => setMobileMenu(!mobileMenu)} className="text-white"><Menu/></button>
        </header>
        {mobileMenu && (
            <div className="fixed inset-0 bg-slate-900 z-50 p-4 lg:hidden">
                <button onClick={() => setMobileMenu(false)} className="absolute top-4 right-4 text-white"><X/></button>
                <nav className="mt-12 space-y-2">
                    {navs.map(n => (
                        <Link key={n.to} to={n.to} onClick={() => setMobileMenu(false)} className="flex items-center gap-3 p-4 rounded-lg bg-slate-800 text-white font-bold">
                            <n.icon size={20}/> {n.label}
                        </Link>
                    ))}
                    <button onClick={logout} className="w-full flex items-center gap-3 p-4 rounded-lg bg-red-900/20 text-red-400 font-bold mt-8">
                        <LogOut size={20}/> Déconnexion
                    </button>
                </nav>
            </div>
        )}
        <div className="p-6 lg:p-10 max-w-7xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            {children}
        </div>
      </main>

      {/* MODALE DE PROFIL */}
      {showProfile && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
           <div className="bg-white dark:bg-slate-800 w-full max-w-md p-6 rounded-xl shadow-2xl border dark:border-slate-700 animate-in fade-in zoom-in duration-300">
              <div className="flex justify-between items-center mb-6 border-b dark:border-slate-700 pb-4">
                 <h2 className="text-xl font-black text-slate-900 dark:text-white">Mon Profil Officier</h2>
                 <button onClick={() => setShowProfile(false)}><X className="text-slate-500 hover:text-white"/></button>
              </div>
              
              <form onSubmit={saveProfile} className="space-y-4">
                 <div className="flex justify-center mb-6">
                    <div 
                        className="w-24 h-24 rounded-full bg-slate-200 dark:bg-slate-700 relative group cursor-pointer overflow-hidden border-4 border-blue-600/30 hover:border-blue-600 transition-all"
                        onClick={() => fileInputRef.current.click()}
                    >
                        {profileForm.profile_picture instanceof File ? (
                            <img src={URL.createObjectURL(profileForm.profile_picture)} className="w-full h-full object-cover" />
                        ) : user?.profile_picture ? (
                            <img src={user.profile_picture} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400"><User size={40}/></div>
                        )}
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Camera className="text-white"/>
                        </div>
                    </div>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={e => setProfileForm({...profileForm, profile_picture: e.target.files[0]})} />
                 </div>

                 <div className="grid grid-cols-2 gap-3">
                    <InputField label="Prénom" value={profileForm.first_name} onChange={e => setProfileForm({...profileForm, first_name: e.target.value})} />
                    <InputField label="Nom" value={profileForm.last_name} onChange={e => setProfileForm({...profileForm, last_name: e.target.value})} />
                 </div>
                 <InputField label="Téléphone" value={profileForm.phone} onChange={e => setProfileForm({...profileForm, phone: e.target.value})} />
                 
                 <div className="pt-2 border-t dark:border-slate-700">
                    <p className="text-xs font-bold text-blue-500 uppercase mb-2">Sécurité</p>
                    <InputField label="Nouveau mot de passe" type="password" placeholder="Laisser vide si inchangé" value={profileForm.password} onChange={e => setProfileForm({...profileForm, password: e.target.value})} />
                 </div>

                 <div className="flex gap-3 pt-4">
                    <button type="button" onClick={() => setShowProfile(false)} className="flex-1 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white font-bold rounded-lg">Annuler</button>
                    <button type="submit" className="flex-1 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">Enregistrer</button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  )
}

function Dashboard() {
  const { user, hasPerm } = useAuth()
  const [stats, setStats] = useState(null)
  const [myStats, setMyStats] = useState(null)

  useEffect(() => {
    // Stats Admin si permission (Total effectif, etc.)
    if (hasPerm('view_logs')) {
        apiFetch("/api/admin/stats").then(r => r.ok ? r.json() : null).then(setStats).catch(() => {})
    }
    // Stats Perso (Toujours chargé : Mes dossiers, etc.)
    apiFetch("/api/users/me/stats").then(r => r.ok ? r.json() : null).then(setMyStats).catch(() => {})
  }, [])

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2">TABLEAU DE BORD</h1>
        <p className="text-slate-500 font-medium">Bienvenue, {user?.grade_name} {user?.last_name}. Prêt pour le service ?</p>
      </div>

      {/* Stats Personnelles */}
      <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Ma Performance</h2>
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <StatCard label="Dossiers Traités" value={myStats?.my_appointments || "0"} icon={ClipboardList} color="blue" />
        <StatCard label="Civils Enregistrés" value={myStats?.my_patients || "0"} icon={Users} color="green" />
        <StatCard label="Statut" value="En Service" icon={CheckCircle} color="yellow" />
      </div>

      {/* Stats Globales (Si Admin/Haut Gradé) */}
      {stats && (
        <>
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Vue Globale Commandement</h2>
            <div className="grid md:grid-cols-4 gap-6 mb-8">
                <StatCard label="Effectif Total" value={stats.users?.total || 0} icon={Shield} color="blue" />
                <StatCard label="Plaintes En Attente" value={stats.appointments?.pending || 0} icon={AlertTriangle} color="red" />
                <StatCard label="Citoyens Fichés" value={stats.patients?.total || 0} icon={Users} color="blue" />
                <StatCard label="Rapports d'Intervention" value={stats.reports?.total || 0} icon={FileText} color="green" />
            </div>
        </>
      )}

      {/* Layout Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
             <h2 className="font-bold text-lg text-slate-800 dark:text-white mb-4">Accès Rapide</h2>
             <div className="grid md:grid-cols-2 gap-4">
                <Link to="/plaintes" className="bg-white dark:bg-slate-800 p-6 rounded-xl border-l-4 border-blue-500 shadow-sm flex items-center gap-4 hover:scale-105 transition-transform cursor-pointer">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600"><ClipboardList size={24}/></div>
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-white">Gérer Plaintes</h3>
                        <p className="text-xs text-slate-500">Traiter les dépôts de plainte</p>
                    </div>
                    <ChevronRight className="ml-auto text-slate-400"/>
                </Link>
                <Link to="/roster" className="bg-white dark:bg-slate-800 p-6 rounded-xl border-l-4 border-emerald-500 shadow-sm flex items-center gap-4 hover:scale-105 transition-transform cursor-pointer">
                    <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-emerald-600"><Users size={24}/></div>
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-white">Effectif LSPD</h3>
                        <p className="text-xs text-slate-500">Voir la liste des officiers</p>
                    </div>
                    <ChevronRight className="ml-auto text-slate-400"/>
                </Link>
             </div>
          </div>

          <div>
             <h2 className="font-bold text-lg text-slate-800 dark:text-white mb-4">Activité Récente</h2>
             <div className="space-y-3">
                {myStats?.recent_activity?.length > 0 ? (
                    myStats.recent_activity.map(a => (
                        <div key={a.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm text-sm">
                            <div className="font-bold text-slate-800 dark:text-white uppercase text-xs tracking-wider mb-1 text-blue-500">{a.title}</div>
                            <div className="text-slate-300 font-medium mb-1">{a.patient_name}</div>
                            <div className="text-xs text-slate-500 text-right">{new Date(a.date).toLocaleDateString()}</div>
                        </div>
                    ))
                ) : (
                    <div className="text-center p-6 text-slate-400 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">Aucune activité récente</div>
                )}
             </div>
          </div>
      </div>
    </Layout>
  )
}

function Plaintes() {
  const { user, hasPerm } = useAuth()
  const [complaints, setComplaints] = useState([])
  const load = () => apiFetch("/api/appointments").then(r => r.json()).then(d => setComplaints(Array.isArray(d) ? d : [])).catch(() => setComplaints([]))
  useEffect(() => { load() }, [])
  const handleStatus = async (id, action) => {
    await apiFetch(`/api/appointments/${id}/${action}`, { method: "POST" })
    load()
  }
  return (
    <Layout>
      <div className="flex justify-between items-center mb-8">
         <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white">PLAINTES & REQUÊTES</h1>
            <p className="text-slate-500 text-sm">Gestion des dossiers citoyens</p>
         </div>
         <button onClick={load} className="p-2 bg-slate-200 dark:bg-slate-700 rounded-lg hover:opacity-80"><Activity size={20}/></button>
      </div>
      <div className="grid gap-4">
        {complaints.map(c => (
          <div key={c.id} className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row justify-between gap-4">
             <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                   <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${c.status === 'pending' ? 'bg-amber-100 text-amber-700' : c.status === 'assigned' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {c.status === 'pending' ? 'En Attente' : c.status === 'assigned' ? 'En Cours' : 'Clôturé'}
                   </span>
                   <span className="text-slate-400 text-xs font-mono">{new Date(c.created_at).toLocaleDateString()}</span>
                </div>
                <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-1">{c.appointment_type} - {c.patient_name}</h3>
                <p className="text-slate-500 text-sm mb-3 italic">"{c.description}"</p>
                <div className="flex gap-4 text-xs text-slate-400 font-mono">
                   <span className="flex items-center gap-1"><Phone size={12}/> {c.patient_phone || "N/A"}</span>
                </div>
             </div>
             {c.status !== 'completed' && hasPerm('manage_appointments') && (
                <div className="flex md:flex-col gap-2 pt-4 md:pt-0 md:pl-4 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700 justify-center">
                   {c.status === 'pending' && <button onClick={() => handleStatus(c.id, 'assign')} className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700">Prendre en charge</button>}
                   {c.status === 'assigned' && <button onClick={() => handleStatus(c.id, 'complete')} className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700">Clôturer</button>}
                   <button onClick={() => handleStatus(c.id, 'cancel')} className="px-4 py-2 bg-red-600/10 text-red-500 text-sm font-bold rounded-lg hover:bg-red-600/20">Refuser</button>
                </div>
             )}
          </div>
        ))}
        {complaints.length === 0 && <div className="text-center p-12 text-slate-400 font-medium bg-slate-800/50 rounded-xl border border-dashed border-slate-700">Aucune plainte à traiter</div>}
      </div>
    </Layout>
  )
}

function Roster() {
  const [members, setMembers] = useState([])
  useEffect(() => { apiFetch("/api/users/roster").then(r => r.json()).then(d => setMembers(Array.isArray(d) ? d : [])) }, [])
  
  const order = ["High Command", "Command Staff", "Supervisors", "Officers", "Système"];
  const grouped = members.reduce((acc, m) => {
      const cat = m.grade_category || "Autres";
      if(!acc[cat]) acc[cat] = [];
      acc[cat].push(m);
      return acc;
  }, {});

  return (
    <Layout>
      <div className="mb-8">
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">EFFECTIFS LSPD</h1>
          <p className="text-slate-500 font-medium">Liste des officiers et état-major</p>
      </div>
      <div className="space-y-8">
         {order.map(cat => grouped[cat] && (
            <div key={cat}>
               <h3 className="text-sm font-black uppercase tracking-widest text-blue-600 mb-4 border-b border-blue-900/30 pb-2">{cat}</h3>
               <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {grouped[cat].sort((a,b) => b.grade_level - a.grade_level).map(m => (
                     <div key={m.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl flex items-center gap-4 border border-slate-200 dark:border-slate-700 shadow-sm border-l-4" style={{borderLeftColor: m.grade_color}}>
                        <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center font-bold text-slate-500 overflow-hidden ring-2 ring-slate-600">
                           {m.profile_picture ? <img src={m.profile_picture} className="w-full h-full object-cover"/> : (m.first_name?.[0] || "?")}
                        </div>
                        <div>
                           <p className="font-bold text-slate-800 dark:text-white">{m.grade_name}</p>
                           <p className="text-sm text-slate-500">{m.last_name} {m.first_name}</p>
                           <p className="text-xs font-mono text-slate-400 mt-0.5">Mle: {m.badge_number || "N/A"}</p>
                        </div>
                     </div>
                  ))}
               </div>
            </div>
         ))}
      </div>
    </Layout>
  )
}

function Admin() {
  const { user, hasPerm } = useAuth()
  const [activeTab, setActiveTab] = useState("users")
  const [users, setUsers] = useState([])
  const [grades, setGrades] = useState([])
  const [logs, setLogs] = useState([])
  const [performance, setPerformance] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editingId, setEditingId] = useState(null)
  
  // Formulaire pour créer/modifier un utilisateur
  const [form, setForm] = useState({ username: "", password: "", first_name: "", last_name: "", badge_number: "", grade_id: "", visible_grade_id: "" })

  const load = () => { 
      if(activeTab === 'users') apiFetch("/api/admin/users").then(r => r.json()).then(setUsers);
      if(activeTab === 'grades') apiFetch("/api/admin/grades").then(r => r.json()).then(setGrades);
      if(activeTab === 'logs') apiFetch("/api/admin/logs").then(r => r.json()).then(setLogs);
      if(activeTab === 'performance') apiFetch("/api/admin/performance").then(r => r.json()).then(setPerformance);
      // Toujours charger les grades pour le formulaire
      apiFetch("/api/admin/grades").then(r => r.json()).then(setGrades);
  }
  useEffect(() => { load() }, [activeTab])

  // Ouvrir la modale en mode Création
  const openCreateModal = () => {
      setForm({ username: "", password: "", first_name: "", last_name: "", badge_number: "", grade_id: "", visible_grade_id: "" });
      setIsEditing(false);
      setEditingId(null);
      setShowModal(true);
  }

  // Ouvrir la modale en mode Modification
  const openEditModal = (u) => {
      setForm({ 
          username: u.username, 
          password: "", // Laisser vide si on ne change pas
          first_name: u.first_name, 
          last_name: u.last_name, 
          badge_number: u.badge_number, 
          grade_id: u.grade_id, 
          visible_grade_id: u.visible_grade_id || "" 
      });
      setIsEditing(true);
      setEditingId(u.id);
      setShowModal(true);
  }

  const submitUser = async (e) => {
    e.preventDefault()
    
    // Mode Modification vs Création
    if (isEditing) {
        // Pour modifier, il faudrait idéalement une route PUT /api/admin/users/:id
        // Comme elle n'est pas encore créée dans ce fichier unique, on va utiliser la création pour l'instant
        // ou vous pouvez ajouter la route PUT correspondante côté backend.
        // NOTE: Pour que ça marche SANS changer le backend maintenant, il faut que le backend supporte l'update ou qu'on supprime/recrée (mauvaise pratique).
        
        // Mais attendez, j'ai vu que vous vouliez juste l'UI.
        // Si la route PUT n'existe pas, il faut l'ajouter au backend.
        // Comme je ne peux modifier que ce fichier ici, je vais supposer que vous ajouterez la route PUT /users/:id au backend
        // ou utiliser une astuce (mais le backend est requis).
        
        // J'envoie une requête PUT (Assurez-vous d'avoir la route backend correspondante !)
        // Si vous n'avez pas la route, il faudra modifier backend/routes/admin.js aussi.
        // Pour l'instant, je mets le code frontend correct.
        await apiFetch(`/api/admin/users/${editingId}`, { method: "PUT", body: JSON.stringify(form) })
        
    } else {
        await apiFetch("/api/admin/users", { method: "POST", body: JSON.stringify(form) })
    }
    
    setShowModal(false)
    load()
  }
  
  const deleteUser = async (id) => { if(window.confirm("Renvoyer cet officier ?")) { await apiFetch(`/api/admin/users/${id}`, { method: "DELETE" }); load() } }

  const tabs = [
      { id: "users", label: "Utilisateurs", icon: Users },
      { id: "grades", label: "Grades", icon: ShieldAlert },
      { id: "logs", label: "Logs", icon: ScrollText },
      { id: "performance", label: "Performance", icon: BarChart3 }
  ]

  return (
    <Layout>
      <div className="flex justify-between items-center mb-8">
         <h1 className="text-3xl font-black text-slate-900 dark:text-white">ADMINISTRATION</h1>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-colors ${activeTab === t.id ? "bg-blue-600 text-white" : "bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-100"}`}>
                  <t.icon size={16}/> {t.label}
              </button>
          ))}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
         {activeTab === "users" && (
             <>
             <div className="p-4 border-b dark:border-slate-700 flex justify-end"><button onClick={openCreateModal} className="btn-primary flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold"><UserPlus size={16}/> Ajouter</button></div>
             <table className="w-full text-sm text-left">
                <thead className="bg-slate-100 dark:bg-slate-900 text-xs uppercase font-bold text-slate-500"><tr><th className="px-6 py-4">Officier</th><th className="px-6 py-4">Grade</th><th className="px-6 py-4">Matricule</th><th className="px-6 py-4 text-right">Actions</th></tr></thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                   {users.map(u => (
                      <tr key={u.id}>
                         <td className="px-6 py-4 font-bold text-slate-800 dark:text-white">{u.first_name} {u.last_name}</td>
                         <td className="px-6 py-4"><span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium text-xs">{u.grade_name}</span></td>
                         <td className="px-6 py-4 font-mono text-slate-500">{u.badge_number}</td>
                         <td className="px-6 py-4 text-right flex justify-end gap-2">
                            {/* Bouton Modifier */}
                            <button onClick={() => openEditModal(u)} className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors" title="Modifier">
                                <Pencil size={16} />
                            </button>
                            {/* Bouton Supprimer */}
                            {u.id !== user.id && (
                                <button onClick={() => deleteUser(u.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors" title="Exclure">
                                    <Trash2 size={16} />
                                </button>
                            )}
                         </td>
                      </tr>
                   ))}
                </tbody>
             </table>
             </>
         )}
         {activeTab === "logs" && (
             <div className="max-h-[500px] overflow-y-auto">
                 <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 dark:bg-slate-900 text-xs uppercase font-bold text-slate-500 sticky top-0"><tr><th className="px-6 py-4">Date</th><th className="px-6 py-4">Utilisateur</th><th className="px-6 py-4">Action</th><th className="px-6 py-4">Détails</th></tr></thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                       {logs.map((l, i) => (
                          <tr key={i}>
                             <td className="px-6 py-4 text-slate-500">{new Date(l.created_at).toLocaleDateString()} {new Date(l.created_at).toLocaleTimeString()}</td>
                             <td className="px-6 py-4 font-bold">{l.first_name} {l.last_name}</td>
                             <td className="px-6 py-4"><span className="badge bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-xs">{l.action}</span></td>
                             <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{l.details}</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
             </div>
         )}
         {activeTab === "performance" && (
             <table className="w-full text-sm text-left">
                <thead className="bg-slate-100 dark:bg-slate-900 text-xs uppercase font-bold text-slate-500"><tr><th className="px-6 py-4">Officier</th><th className="px-6 py-4 text-center">Plaintes Traitées</th><th className="px-6 py-4 text-center">Actions Totales</th></tr></thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                   {performance.map((p, i) => (
                      <tr key={i}>
                         <td className="px-6 py-4 font-bold text-slate-800 dark:text-white">{p.first_name} {p.last_name}</td>
                         <td className="px-6 py-4 text-center font-mono font-bold text-emerald-500">{p.appointments_completed}</td>
                         <td className="px-6 py-4 text-center font-mono">{p.total_actions}</td>
                      </tr>
                   ))}
                </tbody>
             </table>
         )}
      </div>

      {showModal && (
         <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 w-full max-w-lg p-6 rounded-xl shadow-2xl">
               <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                   {isEditing ? "Modifier Dossier Personnel" : "Nouveau Dossier Personnel"}
               </h2>
               <form onSubmit={submitUser} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                     <InputField label="Prénom" value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} required />
                     <InputField label="Nom" value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} required />
                  </div>
                  <InputField label="Identifiant" value={form.username} onChange={e => setForm({...form, username: e.target.value})} required disabled={isEditing} />
                  <InputField 
                    label={isEditing ? "Nouveau Mot de passe (laisser vide si inchangé)" : "Mot de passe"} 
                    type="password" 
                    value={form.password} 
                    onChange={e => setForm({...form, password: e.target.value})} 
                    required={!isEditing} 
                  />
                  <InputField label="Matricule" value={form.badge_number} onChange={e => setForm({...form, badge_number: e.target.value})} required />
                  <SelectField label="Grade (Hiérarchie)" value={form.grade_id} onChange={e => setForm({...form, grade_id: e.target.value})} required>
                     <option value="">Sélectionner un grade</option>
                     {grades.map(g => <option key={g.id} value={g.id}>{g.name} (Niveau {g.level})</option>)}
                  </SelectField>
                  
                  <div className="pt-2 border-t dark:border-slate-700">
                      <p className="text-xs font-bold text-blue-500 uppercase mb-2">Options Avancées (RP)</p>
                      <SelectField label="Grade Visible (Faux grade pour couverture)" value={form.visible_grade_id} onChange={e => setForm({...form, visible_grade_id: e.target.value})}>
                         <option value="">-- Aucun (Utiliser le vrai grade) --</option>
                         {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </SelectField>
                  </div>

                  <div className="flex gap-3 pt-4">
                     <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white font-bold rounded-lg">Annuler</button>
                     <button type="submit" className="flex-1 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">
                         {isEditing ? "Enregistrer" : "Créer"}
                     </button>
                  </div>
               </form>
            </div>
         </div>
      )}
    </Layout>
  )
}

function PublicComplaint() {
  const [form, setForm] = useState({ patient_name: "", patient_phone: "", patient_discord: "", appointment_type: "Vol", description: "" })
  const [done, setDone] = useState(false)
  const navigate = useNavigate()
  const submit = async (e) => {
    e.preventDefault()
    await fetch("/api/appointments/public", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(form) })
    setDone(true)
  }
  if(done) return (
     <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center text-white mb-6"><CheckCircle size={40}/></div>
        <h1 className="text-3xl font-black text-white mb-2">Plainte Enregistrée</h1>
        <p className="text-slate-400 mb-8 max-w-md">Votre déclaration a bien été transmise aux services du LSPD.</p>
        <button onClick={() => navigate('/')} className="px-6 py-3 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-700">Retour accueil</button>
     </div>
  )
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center p-4">
       <div className="w-full max-w-lg bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl">
          <div className="flex items-center gap-4 mb-8 border-b border-slate-200 dark:border-slate-700 pb-6">
             <Shield size={48} className="text-blue-600"/>
             <div>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white">DÉPOSER UNE PLAINTE</h1>
                <p className="text-slate-500 font-medium text-sm">Formulaire officiel LSPD</p>
             </div>
          </div>
          <form onSubmit={submit} className="space-y-4">
             <InputField label="Identité (Nom Prénom)" placeholder="John Doe" value={form.patient_name} onChange={e => setForm({...form, patient_name: e.target.value})} required />
             <div className="grid grid-cols-2 gap-4">
                <InputField label="Téléphone" placeholder="555-0100" value={form.patient_phone} onChange={e => setForm({...form, patient_phone: e.target.value})} required />
                <InputField label="Discord" placeholder="Ex: pseudo#0000" value={form.patient_discord} onChange={e => setForm({...form, patient_discord: e.target.value})} />
             </div>
             <SelectField label="Motif de la plainte" value={form.appointment_type} onChange={e => setForm({...form, appointment_type: e.target.value})}>
                <option value="Vol">Vol / Cambriolage</option>
                <option value="Agression">Agression / Coups et blessures</option>
                <option value="Menace">Menaces / Harcèlement</option>
                <option value="Dégradation">Dégradation de biens</option>
                <option value="Autre">Autre motif</option>
             </SelectField>
             <TextArea label="Description des faits" placeholder="Décrivez précisément ce qui s'est passé..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} required />
             <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => navigate('/')} className="flex-1 py-3 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-lg">Annuler</button>
                <button type="submit" className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"><Send size={18}/> Envoyer</button>
             </div>
          </form>
       </div>
    </div>
  )
}

function Login() {
  const { login } = useAuth()
  const [form, setForm] = useState({ username: "", password: "" })
  const [err, setErr] = useState("")
  const submit = async (e) => {
    e.preventDefault()
    setErr("")
    const res = await login(form.username, form.password)
    if(res.success) window.location.href = "/dashboard"
    else setErr(res.error || "Erreur d'identification")
  }
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-2xl">
         <div className="text-center mb-8">
            <Shield size={64} className="text-blue-600 mx-auto mb-4"/>
            <h1 className="text-2xl font-black text-white">LSPD INTRANET</h1>
            <p className="text-slate-400 text-sm font-medium">Accès réservé aux officiers</p>
         </div>
         {err && <div className="bg-red-500/20 text-red-400 p-3 rounded-lg mb-4 text-sm font-bold text-center">{err}</div>}
         <form onSubmit={submit} className="space-y-4">
            <InputField label="Matricule / Identifiant" value={form.username} onChange={e => setForm({...form, username: e.target.value})} />
            <InputField label="Mot de passe" type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
            <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors shadow-lg shadow-blue-900/50">CONNEXION</button>
         </form>
         <div className="mt-6 text-center">
             <Link to="/plainte" className="text-slate-500 hover:text-white text-xs font-bold uppercase tracking-wider transition-colors">Déposer une plainte (Civil)</Link>
         </div>
      </div>
    </div>
  )
}

function Landing() {
   return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden">
         <div className="relative z-10 text-center space-y-8 p-6">
            <Shield size={120} className="text-blue-700 mx-auto drop-shadow-2xl"/>
            <div>
               <h1 className="text-6xl font-black text-white tracking-tighter mb-2">L.S.P.D</h1>
               <p className="text-blue-400 text-xl font-bold uppercase tracking-widest">Los Santos Police Department</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 pt-8">
               <Link to="/login" className="px-8 py-4 bg-blue-700 hover:bg-blue-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-900/50 flex items-center justify-center gap-2"><Lock size={20}/> ACCÈS OFFICIER</Link>
               <Link to="/plainte" className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all border border-slate-700 flex items-center justify-center gap-2"><FileText size={20}/> PORTER PLAINTE</Link>
            </div>
         </div>
         <div className="absolute bottom-6 text-slate-600 text-xs font-mono">SECURE CONNECTION // AUTHORIZED PERSONNEL ONLY</div>
      </div>
   )
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>
  if (!user) return <Navigate to="/login" />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/plainte" element={<PublicComplaint />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/plaintes" element={<ProtectedRoute><Plaintes /></ProtectedRoute>} />
            <Route path="/roster" element={<ProtectedRoute><Roster /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

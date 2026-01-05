import { BrowserRouter, Routes, Route, Navigate, useLocation, Link, useNavigate } from "react-router-dom"
import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react"
import { 
  Shield, Users, ClipboardList, ShieldAlert, LogOut, LayoutDashboard, Menu, X, 
  CheckCircle, Send, Phone, Lock, AlertTriangle, FileText, Activity,
  BarChart3, ScrollText, ChevronRight, UserPlus, User, Camera, Pencil, Trash2, Settings,
  Radio, PlayCircle, StopCircle, MapPin, Car, Clock, Star, Plus, MessageSquare,
  AlertCircle, Siren, PhoneCall, Pin, ChevronDown, Crown, Headphones, UserCheck,
  Timer, Zap, Navigation, CircleDot, RefreshCw
} from "lucide-react"

// ============================================================================
// CONSTANTES - Liste des permissions (doit correspondre au backend)
// ============================================================================
const PERMISSIONS_LIST = [
  { key: "access_dashboard", label: "Accès Dashboard", description: "Voir le tableau de bord" },
  { key: "view_roster", label: "Voir Effectifs", description: "Consulter la liste des officiers" },
  { key: "manage_appointments", label: "Gérer Plaintes", description: "Assigner, clôturer, refuser les plaintes" },
  { key: "delete_appointments", label: "Supprimer Plaintes", description: "Supprimer définitivement les plaintes" },
  { key: "manage_users", label: "Gérer Utilisateurs", description: "Créer et modifier les officiers" },
  { key: "delete_users", label: "Exclure Officiers", description: "Supprimer définitivement les officiers" },
  { key: "manage_grades", label: "Gérer Grades", description: "Modifier les grades et permissions" },
  { key: "view_logs", label: "Voir les Logs", description: "Accéder aux journaux d'audit" }
];

const PATROL_STATUSES = [
  { id: 'available', label: 'Disponible', color: 'emerald', icon: CheckCircle },
  { id: 'busy', label: 'Occupé', color: 'amber', icon: AlertCircle },
  { id: 'emergency', label: 'Urgence', color: 'red', icon: Siren },
  { id: 'break', label: 'Pause', color: 'slate', icon: Clock },
  { id: 'offline', label: 'Hors service', color: 'gray', icon: X }
];

const CALL_TYPES = [
  { id: 'vol', label: 'Vol / Cambriolage', priority: 1 },
  { id: 'agression', label: 'Agression', priority: 2 },
  { id: 'accident', label: 'Accident de la route', priority: 1 },
  { id: 'tapage', label: 'Tapage / Nuisances', priority: 0 },
  { id: 'suspect', label: 'Individu suspect', priority: 1 },
  { id: 'poursuite', label: 'Course-poursuite', priority: 2 },
  { id: 'arme', label: 'Arme à feu', priority: 2 },
  { id: 'autre', label: 'Autre intervention', priority: 0 }
];

// ============================================================================
// THEME CONTEXT
// ============================================================================
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

// ============================================================================
// AUTH CONTEXT
// ============================================================================
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
    apiFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    window.location.href = "/";
  }

  // Vérification des permissions côté client
  const hasPerm = (perm) => {
    if (!user) return false;
    // Niveau 99 (Dev) = toutes permissions
    if (user.grade_level === 99) return true;
    // Flag is_admin = toutes permissions
    if (user.is_admin === true) return true;
    // Vérification dans les permissions du grade
    return user.grade_permissions?.[perm] === true;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasPerm, refreshUser: fetchUser }}>
      {children}
    </AuthContext.Provider>
  )
}

// ============================================================================
// UI COMPONENTS
// ============================================================================
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

const StatCard = ({ label, value, icon: Icon, color = "blue", subtitle }) => {
  const colors = {
    blue: { icon: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-900/30", border: "border-blue-600" },
    green: { icon: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-900/30", border: "border-emerald-600" },
    yellow: { icon: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/30", border: "border-amber-600" },
    red: { icon: "text-red-600", bg: "bg-red-100 dark:bg-red-900/30", border: "border-red-600" },
    purple: { icon: "text-purple-600", bg: "bg-purple-100 dark:bg-purple-900/30", border: "border-purple-600" },
  }
  const c = colors[color] || colors.blue;
  return (
    <div className={`bg-white dark:bg-slate-800 p-6 rounded-xl border-l-4 ${c.border} shadow-sm`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
          <p className="text-3xl font-black text-slate-800 dark:text-white">{value}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-lg ${c.bg} ${c.icon}`}><Icon size={24}/></div>
      </div>
    </div>
  )
}

function SidebarItem({ icon: Icon, label, to, active, badge }) {
  return (
    <Link to={to} className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all ${active ? "bg-blue-600 text-white shadow-lg shadow-blue-900/50" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}>
      <Icon size={18} />
      <span className="flex-1">{label}</span>
      {badge && <span className="px-2 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full">{badge}</span>}
    </Link>
  )
}

// Formatage du temps
const formatDuration = (seconds) => {
  if (!seconds || seconds < 0) return "0m";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const formatDurationLong = (seconds) => {
  if (!seconds || seconds < 0) return "0 minutes";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours} heure${hours > 1 ? 's' : ''} ${minutes} min`;
  return `${minutes} minute${minutes > 1 ? 's' : ''}`;
};

// ============================================================================
// LAYOUT
// ============================================================================
function Layout({ children }) {
  const { user, logout, hasPerm, refreshUser } = useAuth()
  const location = useLocation()
  const [mobileMenu, setMobileMenu] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [serviceStatus, setServiceStatus] = useState(null)
  
  const [profileForm, setProfileForm] = useState({ first_name: "", last_name: "", phone: "", password: "", profile_picture: null })
  const fileInputRef = useRef(null)

  // Vérifier le statut de service
  useEffect(() => {
    const checkService = async () => {
      try {
        const res = await apiFetch("/api/centrale/service/status")
        if (res.ok) {
          const data = await res.json()
          setServiceStatus(data)
        }
      } catch (e) {}
    }
    checkService()
    const interval = setInterval(checkService, 30000) // Refresh toutes les 30s
    return () => clearInterval(interval)
  }, [])

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
      await refreshUser()
      setShowProfile(false)
    } else {
      const err = await res.json()
      alert(err.error || "Erreur lors de la mise à jour")
    }
  }

  // Navigation basée sur les permissions
  const navs = [
    { icon: LayoutDashboard, label: "Dashboard", to: "/dashboard", perm: "access_dashboard" },
    { icon: Radio, label: "Centrale", to: "/centrale", perm: "access_dashboard" },
    { icon: ClipboardList, label: "Plaintes", to: "/plaintes", perm: "access_dashboard" },
    { icon: Users, label: "Effectif LSPD", to: "/roster", perm: "view_roster" },
  ]
  
  // Admin visible si au moins une permission d'admin
  if (hasPerm('manage_users') || hasPerm('view_logs') || hasPerm('manage_grades') || hasPerm('delete_users')) {
    navs.push({ icon: ShieldAlert, label: "Administration", to: "/admin" })
  }

  return (
    <div className="min-h-screen flex bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-sans">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-slate-900 border-r border-slate-800 fixed h-full z-30">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <Shield className="text-blue-600" size={32} />
          <div>
            <h1 className="text-white font-black text-lg tracking-tight">L.S.P.D</h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">MDT System</p>
          </div>
        </div>

        {/* Statut de service */}
        <div className="p-4 border-b border-slate-800">
          {serviceStatus?.isOnDuty ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-900/30 border border-emerald-700/50 rounded-lg">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-emerald-400 text-xs font-bold uppercase">En service</span>
              <span className="text-emerald-600 text-xs ml-auto">{formatDuration(serviceStatus.service?.current_duration)}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg">
              <div className="w-2 h-2 bg-slate-500 rounded-full"></div>
              <span className="text-slate-400 text-xs font-bold uppercase">Hors service</span>
            </div>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navs.filter(n => !n.perm || hasPerm(n.perm)).map(n => (
            <SidebarItem key={n.to} {...n} active={location.pathname === n.to} />
          ))}
        </nav>
        
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

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Header Mobile */}
        <header className="lg:hidden h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <Shield className="text-blue-600" size={24} />
            <span className="font-bold text-white">LSPD MDT</span>
          </div>
          <div className="flex items-center gap-2">
            {serviceStatus?.isOnDuty && (
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            )}
            <button onClick={() => setMobileMenu(!mobileMenu)} className="text-white"><Menu/></button>
          </div>
        </header>
        
        {/* Menu Mobile */}
        {mobileMenu && (
          <div className="fixed inset-0 bg-slate-900 z-50 p-4 lg:hidden">
            <button onClick={() => setMobileMenu(false)} className="absolute top-4 right-4 text-white"><X/></button>
            <nav className="mt-12 space-y-2">
              {navs.filter(n => !n.perm || hasPerm(n.perm)).map(n => (
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

      {/* Modal Profil */}
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

// ============================================================================
// DASHBOARD
// ============================================================================

function Dashboard() {
  const { user, hasPerm } = useAuth()
  const [stats, setStats] = useState(null)
  const [myStats, setMyStats] = useState(null)
  const [patrolTimes, setPatrolTimes] = useState([])
  const [centraleStats, setCentraleStats] = useState(null)

  useEffect(() => {
    if (hasPerm('view_logs')) {
      apiFetch("/api/admin/stats").then(r => r.ok ? r.json() : null).then(setStats).catch(() => {})
    }
    apiFetch("/api/users/me/stats").then(r => r.ok ? r.json() : null).then(setMyStats).catch(() => {})
    apiFetch("/api/centrale/patrol-times").then(r => r.ok ? r.json() : []).then(setPatrolTimes).catch(() => [])
    apiFetch("/api/centrale/stats").then(r => r.ok ? r.json() : null).then(setCentraleStats).catch(() => {})
  }, [])

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2">TABLEAU DE BORD</h1>
        <p className="text-slate-500 font-medium">Bienvenue, {user?.grade_name} {user?.last_name}. Prêt pour le service ?</p>
      </div>

      {/* Stats Centrale */}
      {centraleStats && (
        <>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Centrale en direct</h2>
          <div className="grid md:grid-cols-4 gap-4 mb-8">
            <StatCard label="En Service" value={centraleStats.officersOnline} icon={UserCheck} color="green" />
            <StatCard label="Patrouilles" value={centraleStats.activePatrols} icon={Car} color="blue" />
            <StatCard label="Appels en cours" value={centraleStats.pendingCalls} icon={PhoneCall} color="yellow" />
            <StatCard label="Services Aujourd'hui" value={centraleStats.todayServices} icon={Timer} color="purple" />
          </div>
        </>
      )}

      <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Ma Performance</h2>
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <StatCard label="Dossiers Traités" value={myStats?.my_appointments || "0"} icon={ClipboardList} color="blue" />
        <StatCard label="Civils Enregistrés" value={myStats?.my_patients || "0"} icon={Users} color="green" />
        <StatCard label="Statut" value="En Service" icon={CheckCircle} color="yellow" />
      </div>

      {stats && (
        <>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Vue Globale Commandement</h2>
          <div className="grid md:grid-cols-4 gap-6 mb-8">
            <StatCard label="Effectif Total" value={stats.users?.total || 0} icon={Shield} color="blue" />
            <StatCard label="Plaintes En Attente" value={stats.appointments?.pending || 0} icon={AlertTriangle} color="red" />
            <StatCard label="Citoyens Fichés" value={stats.patients?.total || 0} icon={Users} color="blue" />
            <StatCard label="Rapports" value={stats.reports?.total || 0} icon={FileText} color="green" />
          </div>
        </>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <h2 className="font-bold text-lg text-slate-800 dark:text-white mb-4">Accès Rapide</h2>
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <Link to="/centrale" className="bg-white dark:bg-slate-800 p-6 rounded-xl border-l-4 border-purple-500 shadow-sm flex items-center gap-4 hover:scale-105 transition-transform cursor-pointer">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600"><Radio size={24}/></div>
              <div>
                <h3 className="font-bold text-slate-800 dark:text-white">Centrale</h3>
                <p className="text-xs text-slate-500">Gestion des patrouilles</p>
              </div>
              <ChevronRight className="ml-auto text-slate-400"/>
            </Link>
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

          {/* Temps de patrouille */}
          <h2 className="font-bold text-lg text-slate-800 dark:text-white mb-4 flex items-center gap-2">
            <Timer size={20} className="text-blue-500"/>
            Temps de Patrouille
          </h2>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 dark:bg-slate-900 text-xs uppercase font-bold text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Officier</th>
                    <th className="px-4 py-3 text-left">Grade</th>
                    <th className="px-4 py-3 text-right">Temps Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {patrolTimes.slice(0, 10).map((p, i) => (
                    <tr key={p.id} className={i < 3 ? "bg-amber-50/50 dark:bg-amber-900/10" : ""}>
                      <td className="px-4 py-3 font-medium flex items-center gap-2">
                        {i === 0 && <Crown size={16} className="text-amber-500"/>}
                        {i === 1 && <Star size={16} className="text-slate-400"/>}
                        {i === 2 && <Star size={16} className="text-amber-700"/>}
                        <span className="text-slate-800 dark:text-white">{p.first_name} {p.last_name}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 rounded text-xs font-medium" style={{backgroundColor: p.grade_color + '20', color: p.grade_color}}>
                          {p.grade_name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-600 dark:text-slate-300">
                        {formatDurationLong(p.total_patrol_time || p.calculated_time || 0)}
                      </td>
                    </tr>
                  ))}
                  {patrolTimes.length === 0 && (
                    <tr>
                      <td colSpan="3" className="px-4 py-8 text-center text-slate-400">
                        Aucune donnée de patrouille
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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

// ============================================================================
// CENTRALE - PAGE PRINCIPALE
// ============================================================================

function Centrale() {
  const { user } = useAuth()
  const [serviceStatus, setServiceStatus] = useState(null)
  const [onlineOfficers, setOnlineOfficers] = useState([])
  const [patrols, setPatrols] = useState([])
  const [notes, setNotes] = useState([])
  const [dispatches, setDispatches] = useState([])
  const [currentOperator, setCurrentOperator] = useState(null)
  const [loading, setLoading] = useState(true)
  
  // Modals
  const [showPatrolModal, setShowPatrolModal] = useState(false)
  const [showDispatchModal, setShowDispatchModal] = useState(false)
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [editingPatrol, setEditingPatrol] = useState(null)
  const [selectedPatrol, setSelectedPatrol] = useState(null)
  
  // Forms
  const [patrolForm, setPatrolForm] = useState({ name: '', call_sign: '', vehicle: '', sector: '', notes: '' })
  const [dispatchForm, setDispatchForm] = useState({ call_type: '', location: '', description: '', priority: 0, patrol_id: '' })
  const [noteForm, setNoteForm] = useState({ content: '', note_type: 'info', patrol_id: '', is_pinned: false })

  const loadData = useCallback(async () => {
    try {
      const [statusRes, onlineRes, patrolsRes, notesRes, dispatchRes, operatorRes] = await Promise.all([
        apiFetch("/api/centrale/service/status"),
        apiFetch("/api/centrale/service/online"),
        apiFetch("/api/centrale/patrols"),
        apiFetch("/api/centrale/notes?limit=30"),
        apiFetch("/api/centrale/dispatch?limit=20"),
        apiFetch("/api/centrale/operator/current")
      ])

      if (statusRes.ok) setServiceStatus(await statusRes.json())
      if (onlineRes.ok) {
        const data = await onlineRes.json()
        setOnlineOfficers(data.officers || [])
      }
      if (patrolsRes.ok) setPatrols(await patrolsRes.json())
      if (notesRes.ok) setNotes(await notesRes.json())
      if (dispatchRes.ok) setDispatches(await dispatchRes.json())
      if (operatorRes.ok) {
        const data = await operatorRes.json()
        setCurrentOperator(data.operator)
      }
    } catch (e) {
      console.error("Erreur chargement centrale:", e)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 15000) // Refresh toutes les 15s
    return () => clearInterval(interval)
  }, [loadData])

  // Actions Service
  const startService = async () => {
    const res = await apiFetch("/api/centrale/service/start", { method: "POST" })
    if (res.ok) loadData()
    else {
      const err = await res.json()
      alert(err.error || "Erreur")
    }
  }

  const endService = async () => {
    if (!window.confirm("Êtes-vous sûr de vouloir terminer votre service ?")) return
    const res = await apiFetch("/api/centrale/service/end", { method: "POST" })
    if (res.ok) loadData()
    else {
      const err = await res.json()
      alert(err.error || "Erreur")
    }
  }

  // Actions Patrouilles
  const openCreatePatrol = () => {
    setPatrolForm({ name: '', call_sign: '', vehicle: '', sector: '', notes: '' })
    setEditingPatrol(null)
    setShowPatrolModal(true)
  }

  const openEditPatrol = (patrol) => {
    setPatrolForm({
      name: patrol.name,
      call_sign: patrol.call_sign || '',
      vehicle: patrol.vehicle || '',
      sector: patrol.sector || '',
      notes: patrol.notes || ''
    })
    setEditingPatrol(patrol)
    setShowPatrolModal(true)
  }

  const savePatrol = async (e) => {
    e.preventDefault()
    const method = editingPatrol ? "PUT" : "POST"
    const url = editingPatrol ? `/api/centrale/patrols/${editingPatrol.id}` : "/api/centrale/patrols"
    
    const res = await apiFetch(url, { method, body: JSON.stringify(patrolForm) })
    if (res.ok) {
      setShowPatrolModal(false)
      loadData()
    } else {
      const err = await res.json()
      alert(err.error || "Erreur")
    }
  }

  const deletePatrol = async (id) => {
    if (!window.confirm("Supprimer cette patrouille ?")) return
    const res = await apiFetch(`/api/centrale/patrols/${id}`, { method: "DELETE" })
    if (res.ok) loadData()
  }

  const updatePatrolStatus = async (patrolId, status) => {
    const res = await apiFetch(`/api/centrale/patrols/${patrolId}`, { 
      method: "PUT", 
      body: JSON.stringify({ status }) 
    })
    if (res.ok) loadData()
  }

  // Assignation
  const openAssignModal = (patrol) => {
    setSelectedPatrol(patrol)
    setShowAssignModal(true)
  }

  const assignOfficer = async (userId) => {
    const res = await apiFetch(`/api/centrale/patrols/${selectedPatrol.id}/assign`, {
      method: "POST",
      body: JSON.stringify({ userId })
    })
    if (res.ok) {
      loadData()
    } else {
      const err = await res.json()
      alert(err.error || "Erreur")
    }
  }

  const unassignOfficer = async (patrolId, userId) => {
    const res = await apiFetch(`/api/centrale/patrols/${patrolId}/unassign`, {
      method: "POST",
      body: JSON.stringify({ userId })
    })
    if (res.ok) loadData()
  }

  const setLeader = async (patrolId, userId) => {
    const res = await apiFetch(`/api/centrale/patrols/${patrolId}/leader`, {
      method: "POST",
      body: JSON.stringify({ userId })
    })
    if (res.ok) loadData()
  }

  // Opérateur
  const assignOperator = async (userId) => {
    const res = await apiFetch("/api/centrale/operator/assign", {
      method: "POST",
      body: JSON.stringify({ userId })
    })
    if (res.ok) loadData()
    else {
      const err = await res.json()
      alert(err.error || "Erreur")
    }
  }

  const removeOperator = async (userId) => {
    const res = await apiFetch("/api/centrale/operator/remove", {
      method: "POST",
      body: JSON.stringify({ userId })
    })
    if (res.ok) loadData()
  }

  // Notes
  const saveNote = async (e) => {
    e.preventDefault()
    const res = await apiFetch("/api/centrale/notes", { method: "POST", body: JSON.stringify(noteForm) })
    if (res.ok) {
      setShowNoteModal(false)
      setNoteForm({ content: '', note_type: 'info', patrol_id: '', is_pinned: false })
      loadData()
    }
  }

  const deleteNote = async (id) => {
    await apiFetch(`/api/centrale/notes/${id}`, { method: "DELETE" })
    loadData()
  }

  const togglePinNote = async (id) => {
    await apiFetch(`/api/centrale/notes/${id}/pin`, { method: "POST" })
    loadData()
  }

  // Dispatch
  const saveDispatch = async (e) => {
    e.preventDefault()
    const res = await apiFetch("/api/centrale/dispatch", { method: "POST", body: JSON.stringify(dispatchForm) })
    if (res.ok) {
      setShowDispatchModal(false)
      setDispatchForm({ call_type: '', location: '', description: '', priority: 0, patrol_id: '' })
      loadData()
    }
  }

  const updateDispatchStatus = async (id, status) => {
    await apiFetch(`/api/centrale/dispatch/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status })
    })
    loadData()
  }

  const assignDispatch = async (dispatchId, patrolId) => {
    await apiFetch(`/api/centrale/dispatch/${dispatchId}/assign`, {
      method: "POST",
      body: JSON.stringify({ patrol_id: patrolId })
    })
    loadData()
  }

  // Officiers disponibles (en service mais pas dans une patrouille)
  const availableOfficers = onlineOfficers.filter(o => !o.patrol_id)

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </Layout>
    )
  }

  // Si pas en service, afficher l'écran de prise de service
  if (!serviceStatus?.isOnDuty) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mb-6 border-4 border-slate-700">
            <Radio size={48} className="text-slate-500"/>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-2">CENTRALE LSPD</h1>
          <p className="text-slate-500 mb-8 text-center max-w-md">
            Vous devez prendre votre service pour accéder à la centrale et aux patrouilles.
          </p>
          <button 
            onClick={startService}
            className="flex items-center gap-3 px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-900/30"
          >
            <PlayCircle size={24}/>
            PRENDRE SON SERVICE
          </button>
        </div>
      </Layout>
    )
  }

  const canManage = serviceStatus.canManageCentrale || user.grade_level === 99

  return (
    <Layout>
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <Radio className="text-purple-500"/>
            CENTRALE
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {onlineOfficers.length} officier{onlineOfficers.length > 1 ? 's' : ''} en service • {patrols.length} patrouille{patrols.length > 1 ? 's' : ''} active{patrols.length > 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={loadData} className="p-2 bg-slate-200 dark:bg-slate-700 rounded-lg hover:opacity-80">
            <RefreshCw size={20}/>
          </button>
          <button 
            onClick={endService}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg"
          >
            <StopCircle size={18}/> Fin de service
          </button>
        </div>
      </div>

      {/* Info Service */}
      <div className="bg-gradient-to-r from-emerald-900/30 to-blue-900/30 border border-emerald-700/30 rounded-xl p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
            <div>
              <p className="text-emerald-400 font-bold">En service depuis {formatDuration(serviceStatus.service?.current_duration)}</p>
              {serviceStatus.patrol && (
                <p className="text-sm text-slate-400">
                  Patrouille: <span className="text-white font-medium">{serviceStatus.patrol.name}</span>
                  {serviceStatus.patrol.call_sign && <span className="ml-2 text-blue-400">({serviceStatus.patrol.call_sign})</span>}
                </p>
              )}
            </div>
          </div>
          {currentOperator && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-900/30 border border-purple-700/50 rounded-lg">
              <Headphones size={16} className="text-purple-400"/>
              <span className="text-purple-300 text-sm">
                Centrale: <span className="font-bold text-white">{currentOperator.first_name} {currentOperator.last_name}</span>
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Colonne gauche: Officiers en service */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
              <Users size={20} className="text-blue-500"/>
              En Service ({onlineOfficers.length})
            </h2>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
            {onlineOfficers.map(officer => (
              <div 
                key={officer.id} 
                className={`bg-white dark:bg-slate-800 p-3 rounded-xl border ${
                  officer.is_operator ? 'border-purple-500' : 
                  officer.patrol_id ? 'border-blue-500/50' : 'border-slate-200 dark:border-slate-700'
                } shadow-sm`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden ring-2" style={{ringColor: officer.grade_color}}>
                    {officer.profile_picture ? (
                      <img src={officer.profile_picture} className="w-full h-full object-cover"/>
                    ) : (
                      <span className="font-bold text-slate-500">{officer.first_name?.[0]}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-800 dark:text-white text-sm truncate">
                        {officer.first_name} {officer.last_name}
                      </p>
                      {officer.is_operator && <Headphones size={14} className="text-purple-400 flex-shrink-0"/>}
                    </div>
                    <p className="text-xs truncate" style={{color: officer.grade_color}}>{officer.grade_name}</p>
                    {officer.patrol_name && (
                      <p className="text-xs text-blue-400 truncate">{officer.patrol_call_sign || officer.patrol_name}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-mono text-slate-500">{formatDuration(officer.duration)}</p>
                    {!officer.patrol_id && (
                      <span className="text-xs px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded">
                        Dispo
                      </span>
                    )}
                  </div>
                </div>
                
                {canManage && !officer.patrol_id && (
                  <div className="flex gap-1 mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <button
                      onClick={() => assignOperator(officer.id)}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs bg-purple-600/20 text-purple-400 rounded hover:bg-purple-600/30"
                    >
                      <Headphones size={12}/> Centrale
                    </button>
                  </div>
                )}
              </div>
            ))}
            {onlineOfficers.length === 0 && (
              <div className="text-center py-8 text-slate-400 bg-slate-800/50 rounded-xl border border-dashed border-slate-700">
                Aucun officier en service
              </div>
            )}
          </div>
        </div>

        {/* Colonne centrale: Patrouilles */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
              <Car size={20} className="text-emerald-500"/>
              Patrouilles
            </h2>
            {canManage && (
              <div className="flex gap-2">
                <button 
                  onClick={() => setShowDispatchModal(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold rounded-lg"
                >
                  <Siren size={16}/> Appel
                </button>
                <button 
                  onClick={() => setShowNoteModal(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white text-sm font-bold rounded-lg"
                >
                  <MessageSquare size={16}/> Note
                </button>
                <button 
                  onClick={openCreatePatrol}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg"
                >
                  <Plus size={16}/> Patrouille
                </button>
              </div>
            )}
          </div>

          {/* Grille des patrouilles */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            {patrols.map(patrol => {
              const statusInfo = PATROL_STATUSES.find(s => s.id === patrol.status) || PATROL_STATUSES[0]
              const StatusIcon = statusInfo.icon
              
              return (
                <div 
                  key={patrol.id} 
                  className={`bg-white dark:bg-slate-800 rounded-xl border-2 ${
                    patrol.status === 'emergency' ? 'border-red-500 animate-pulse' :
                    patrol.status === 'busy' ? 'border-amber-500' :
                    'border-slate-200 dark:border-slate-700'
                  } shadow-sm overflow-hidden`}
                >
                  {/* Header */}
                  <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg bg-${statusInfo.color}-100 dark:bg-${statusInfo.color}-900/30 flex items-center justify-center`}>
                          <StatusIcon size={20} className={`text-${statusInfo.color}-600`}/>
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800 dark:text-white">{patrol.name}</h3>
                          {patrol.call_sign && (
                            <p className="text-sm font-mono text-blue-500">{patrol.call_sign}</p>
                          )}
                        </div>
                      </div>
                      {canManage && (
                        <div className="flex gap-1">
                          <button onClick={() => openEditPatrol(patrol)} className="p-1.5 text-slate-400 hover:text-blue-500">
                            <Pencil size={14}/>
                          </button>
                          <button onClick={() => deletePatrol(patrol.id)} className="p-1.5 text-slate-400 hover:text-red-500">
                            <Trash2 size={14}/>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Infos */}
                    <div className="flex flex-wrap gap-2 mt-3 text-xs">
                      {patrol.vehicle && (
                        <span className="flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded">
                          <Car size={12}/> {patrol.vehicle}
                        </span>
                      )}
                      {patrol.sector && (
                        <span className="flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded">
                          <MapPin size={12}/> {patrol.sector}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Membres */}
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-500 uppercase">Équipage ({patrol.member_count || 0})</span>
                      {canManage && (
                        <button 
                          onClick={() => openAssignModal(patrol)}
                          className="text-xs text-blue-500 hover:underline"
                        >
                          + Ajouter
                        </button>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      {patrol.members?.map(m => (
                        <div key={m.id} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                          <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center overflow-hidden text-xs font-bold">
                            {m.profile_picture ? (
                              <img src={m.profile_picture} className="w-full h-full object-cover"/>
                            ) : m.first_name?.[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 dark:text-white truncate flex items-center gap-1">
                              {m.first_name} {m.last_name}
                              {m.role === 'leader' && <Crown size={12} className="text-amber-500"/>}
                            </p>
                            <p className="text-xs truncate" style={{color: m.grade_color}}>{m.grade_name}</p>
                          </div>
                          {canManage && (
                            <div className="flex gap-1">
                              {m.role !== 'leader' && (
                                <button 
                                  onClick={() => setLeader(patrol.id, m.id)}
                                  className="p-1 text-slate-400 hover:text-amber-500" title="Chef de patrouille"
                                >
                                  <Crown size={14}/>
                                </button>
                              )}
                              <button 
                                onClick={() => unassignOfficer(patrol.id, m.id)}
                                className="p-1 text-slate-400 hover:text-red-500" title="Retirer"
                              >
                                <X size={14}/>
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                      {(!patrol.members || patrol.members.length === 0) && (
                        <p className="text-xs text-slate-400 text-center py-2">Aucun membre</p>
                      )}
                    </div>
                  </div>

                  {/* Status Actions */}
                  {canManage && (
                    <div className="px-4 pb-4">
                      <div className="flex flex-wrap gap-1">
                        {PATROL_STATUSES.filter(s => s.id !== 'offline').map(s => (
                          <button
                            key={s.id}
                            onClick={() => updatePatrolStatus(patrol.id, s.id)}
                            className={`flex-1 px-2 py-1.5 text-xs font-bold rounded transition-all ${
                              patrol.status === s.id 
                                ? `bg-${s.color}-600 text-white` 
                                : `bg-${s.color}-100 dark:bg-${s.color}-900/20 text-${s.color}-600 hover:bg-${s.color}-200`
                            }`}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes de patrouille */}
                  {patrol.notes && (
                    <div className="px-4 pb-4">
                      <div className="p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <p className="text-xs text-amber-700 dark:text-amber-400">{patrol.notes}</p>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            {patrols.length === 0 && (
              <div className="md:col-span-2 text-center py-12 text-slate-400 bg-slate-800/50 rounded-xl border border-dashed border-slate-700">
                Aucune patrouille active
                {canManage && (
                  <button 
                    onClick={openCreatePatrol}
                    className="block mx-auto mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg"
                  >
                    Créer une patrouille
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Appels Dispatch */}
          {dispatches.filter(d => !['completed', 'cancelled'].includes(d.status)).length > 0 && (
            <div className="mb-6">
              <h3 className="font-bold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
                <Siren size={18} className="text-red-500"/>
                Appels en cours
              </h3>
              <div className="space-y-2">
                {dispatches.filter(d => !['completed', 'cancelled'].includes(d.status)).map(d => (
                  <div key={d.id} className={`p-3 rounded-lg border ${
                    d.priority >= 2 ? 'bg-red-900/20 border-red-700' :
                    d.priority === 1 ? 'bg-amber-900/20 border-amber-700' :
                    'bg-slate-800 border-slate-700'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-white">{d.call_type}</p>
                        <p className="text-sm text-slate-400">{d.location || 'Localisation inconnue'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {d.patrol_name && (
                          <span className="px-2 py-1 bg-blue-900/30 text-blue-400 text-xs rounded">
                            {d.patrol_call_sign || d.patrol_name}
                          </span>
                        )}
                        <span className={`px-2 py-1 text-xs rounded ${
                          d.status === 'pending' ? 'bg-amber-500 text-black' :
                          d.status === 'dispatched' ? 'bg-blue-500 text-white' :
                          d.status === 'en_route' ? 'bg-purple-500 text-white' :
                          'bg-emerald-500 text-white'
                        }`}>
                          {d.status === 'pending' ? 'En attente' :
                           d.status === 'dispatched' ? 'Assigné' :
                           d.status === 'en_route' ? 'En route' : 'Sur place'}
                        </span>
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex gap-2 mt-2">
                        {d.status !== 'on_scene' && (
                          <button 
                            onClick={() => updateDispatchStatus(d.id, 
                              d.status === 'pending' ? 'dispatched' : 
                              d.status === 'dispatched' ? 'en_route' : 'on_scene'
                            )}
                            className="px-2 py-1 bg-blue-600 text-white text-xs rounded"
                          >
                            {d.status === 'pending' ? 'Assigner' : 
                             d.status === 'dispatched' ? 'En route' : 'Sur place'}
                          </button>
                        )}
                        <button 
                          onClick={() => updateDispatchStatus(d.id, 'completed')}
                          className="px-2 py-1 bg-emerald-600 text-white text-xs rounded"
                        >
                          Terminé
                        </button>
                        <button 
                          onClick={() => updateDispatchStatus(d.id, 'cancelled')}
                          className="px-2 py-1 bg-slate-600 text-white text-xs rounded"
                        >
                          Annuler
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes Centrale */}
          <div>
            <h3 className="font-bold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
              <MessageSquare size={18} className="text-blue-500"/>
              Journal de bord
            </h3>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="max-h-60 overflow-y-auto">
                {notes.map(note => (
                  <div key={note.id} className={`p-3 border-b border-slate-200 dark:border-slate-700 last:border-b-0 ${
                    note.is_pinned ? 'bg-amber-50 dark:bg-amber-900/20' :
                    note.note_type === 'urgent' ? 'bg-red-50 dark:bg-red-900/20' :
                    note.note_type === 'warning' ? 'bg-amber-50 dark:bg-amber-900/20' : ''
                  }`}>
                    <div className="flex items-start gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                        note.note_type === 'urgent' ? 'bg-red-100 text-red-600' :
                        note.note_type === 'warning' ? 'bg-amber-100 text-amber-600' :
                        note.note_type === 'dispatch' ? 'bg-purple-100 text-purple-600' :
                        'bg-blue-100 text-blue-600'
                      }`}>
                        {note.note_type === 'urgent' ? <AlertCircle size={14}/> :
                         note.note_type === 'dispatch' ? <Siren size={14}/> :
                         <MessageSquare size={14}/>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-800 dark:text-white">{note.content}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-slate-500">
                            {note.author_first_name} {note.author_last_name}
                          </span>
                          <span className="text-xs text-slate-400">
                            {new Date(note.created_at).toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})}
                          </span>
                          {note.patrol_name && (
                            <span className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded">
                              {note.patrol_call_sign || note.patrol_name}
                            </span>
                          )}
                        </div>
                      </div>
                      {canManage && (
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => togglePinNote(note.id)} className={`p-1 ${note.is_pinned ? 'text-amber-500' : 'text-slate-400'} hover:text-amber-500`}>
                            <Pin size={14}/>
                          </button>
                          <button onClick={() => deleteNote(note.id)} className="p-1 text-slate-400 hover:text-red-500">
                            <Trash2 size={14}/>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {notes.length === 0 && (
                  <div className="p-8 text-center text-slate-400">
                    Aucune note
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Patrouille */}
      {showPatrolModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md p-6 rounded-xl shadow-2xl">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              {editingPatrol ? 'Modifier Patrouille' : 'Nouvelle Patrouille'}
            </h2>
            <form onSubmit={savePatrol} className="space-y-3">
              <InputField label="Nom de la patrouille" placeholder="Ex: Patrouille Centre" value={patrolForm.name} onChange={e => setPatrolForm({...patrolForm, name: e.target.value})} required />
              <InputField label="Indicatif Radio" placeholder="Ex: ADAM-12" value={patrolForm.call_sign} onChange={e => setPatrolForm({...patrolForm, call_sign: e.target.value})} />
              <InputField label="Véhicule" placeholder="Ex: Crown Victoria #42" value={patrolForm.vehicle} onChange={e => setPatrolForm({...patrolForm, vehicle: e.target.value})} />
              <InputField label="Secteur" placeholder="Ex: Downtown, Vinewood..." value={patrolForm.sector} onChange={e => setPatrolForm({...patrolForm, sector: e.target.value})} />
              <TextArea label="Notes" placeholder="Instructions particulières..." value={patrolForm.notes} onChange={e => setPatrolForm({...patrolForm, notes: e.target.value})} />
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowPatrolModal(false)} className="flex-1 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white font-bold rounded-lg">Annuler</button>
                <button type="submit" className="flex-1 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">
                  {editingPatrol ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Assignation */}
      {showAssignModal && selectedPatrol && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md p-6 rounded-xl shadow-2xl">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              Assigner à {selectedPatrol.name}
            </h2>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {availableOfficers.length > 0 ? (
                availableOfficers.map(officer => (
                  <button
                    key={officer.id}
                    onClick={() => { assignOfficer(officer.id); setShowAssignModal(false) }}
                    className="w-full flex items-center gap-3 p-3 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center overflow-hidden">
                      {officer.profile_picture ? (
                        <img src={officer.profile_picture} className="w-full h-full object-cover"/>
                      ) : (
                        <span className="font-bold text-slate-500">{officer.first_name?.[0]}</span>
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 dark:text-white">{officer.first_name} {officer.last_name}</p>
                      <p className="text-xs" style={{color: officer.grade_color}}>{officer.grade_name}</p>
                    </div>
                    <Plus className="ml-auto text-blue-500"/>
                  </button>
                ))
              ) : (
                <div className="text-center py-8 text-slate-400">
                  Aucun officier disponible
                </div>
              )}
            </div>
            <button 
              onClick={() => setShowAssignModal(false)} 
              className="w-full mt-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white font-bold rounded-lg"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Modal Note */}
      {showNoteModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md p-6 rounded-xl shadow-2xl">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Nouvelle Note</h2>
            <form onSubmit={saveNote} className="space-y-3">
              <TextArea label="Message" placeholder="Votre note..." value={noteForm.content} onChange={e => setNoteForm({...noteForm, content: e.target.value})} required />
              <SelectField label="Type" value={noteForm.note_type} onChange={e => setNoteForm({...noteForm, note_type: e.target.value})}>
                <option value="info">Information</option>
                <option value="warning">Attention</option>
                <option value="urgent">Urgent</option>
                <option value="dispatch">Dispatch</option>
              </SelectField>
              <SelectField label="Patrouille (optionnel)" value={noteForm.patrol_id} onChange={e => setNoteForm({...noteForm, patrol_id: e.target.value})}>
                <option value="">-- Toutes --</option>
                {patrols.map(p => <option key={p.id} value={p.id}>{p.call_sign || p.name}</option>)}
              </SelectField>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={noteForm.is_pinned} onChange={e => setNoteForm({...noteForm, is_pinned: e.target.checked})} className="rounded"/>
                <span className="text-sm text-slate-600 dark:text-slate-300">Épingler cette note</span>
              </label>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowNoteModal(false)} className="flex-1 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white font-bold rounded-lg">Annuler</button>
                <button type="submit" className="flex-1 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">Publier</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Dispatch */}
      {showDispatchModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md p-6 rounded-xl shadow-2xl">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Nouvel Appel</h2>
            <form onSubmit={saveDispatch} className="space-y-3">
              <SelectField label="Type d'appel" value={dispatchForm.call_type} onChange={e => {
                const callType = CALL_TYPES.find(c => c.label === e.target.value)
                setDispatchForm({...dispatchForm, call_type: e.target.value, priority: callType?.priority || 0})
              }} required>
                <option value="">Sélectionner...</option>
                {CALL_TYPES.map(c => <option key={c.id} value={c.label}>{c.label}</option>)}
              </SelectField>
              <InputField label="Localisation" placeholder="Ex: Legion Square, Alta Street..." value={dispatchForm.location} onChange={e => setDispatchForm({...dispatchForm, location: e.target.value})} />
              <TextArea label="Description" placeholder="Détails de l'appel..." value={dispatchForm.description} onChange={e => setDispatchForm({...dispatchForm, description: e.target.value})} />
              <SelectField label="Priorité" value={dispatchForm.priority} onChange={e => setDispatchForm({...dispatchForm, priority: parseInt(e.target.value)})}>
                <option value="0">Normale</option>
                <option value="1">Prioritaire</option>
                <option value="2">Urgence</option>
              </SelectField>
              <SelectField label="Assigner à (optionnel)" value={dispatchForm.patrol_id} onChange={e => setDispatchForm({...dispatchForm, patrol_id: e.target.value})}>
                <option value="">-- Non assigné --</option>
                {patrols.filter(p => p.status === 'available').map(p => (
                  <option key={p.id} value={p.id}>{p.call_sign || p.name}</option>
                ))}
              </SelectField>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowDispatchModal(false)} className="flex-1 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white font-bold rounded-lg">Annuler</button>
                <button type="submit" className="flex-1 py-2 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700">Créer l'appel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}

// ============================================================================
// PLAINTES
// ============================================================================

function Plaintes() {
  const { hasPerm } = useAuth()
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  
  const load = () => {
    setLoading(true)
    apiFetch("/api/appointments")
      .then(r => r.json())
      .then(d => setComplaints(Array.isArray(d) ? d : []))
      .catch(() => setComplaints([]))
      .finally(() => setLoading(false))
  }
  
  useEffect(() => { load() }, [])
  
  const handleStatus = async (id, action) => {
    const res = await apiFetch(`/api/appointments/${id}/${action}`, { method: "POST" })
    if (res.ok) {
      load()
    } else {
      const err = await res.json()
      alert(err.error || "Erreur")
    }
  }

  const deleteComplaint = async (id) => {
    if (!hasPerm('delete_appointments')) {
      alert("Vous n'avez pas la permission de supprimer des plaintes")
      return
    }
    if (window.confirm("Êtes-vous sûr de vouloir SUPPRIMER DÉFINITIVEMENT ce dossier ?\n\nCette action est irréversible.")) {
      const res = await apiFetch(`/api/appointments/${id}`, { method: "DELETE" })
      if (res.ok) {
        load()
      } else {
        const err = await res.json()
        alert(err.error || "Erreur lors de la suppression")
      }
    }
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
      
      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      ) : (
        <div className="grid gap-4">
          {complaints.map(c => (
            <div key={c.id} className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                    c.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 
                    c.status === 'assigned' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 
                    c.status === 'cancelled' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  }`}>
                    {c.status === 'pending' ? 'En Attente' : c.status === 'assigned' ? 'En Cours' : c.status === 'cancelled' ? 'Refusée' : 'Clôturée'}
                  </span>
                  <span className="text-slate-400 text-xs font-mono">#{c.id} • {new Date(c.created_at).toLocaleDateString()}</span>
                </div>
                <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-1">{c.appointment_type} - {c.patient_name}</h3>
                <p className="text-slate-500 text-sm mb-3 italic line-clamp-2">"{c.description}"</p>
                <div className="flex gap-4 text-xs text-slate-400 font-mono">
                  <span className="flex items-center gap-1"><Phone size={12}/> {c.patient_phone || "N/A"}</span>
                  {c.medic_first_name && <span>Assigné: {c.medic_first_name} {c.medic_last_name}</span>}
                </div>
              </div>
              
              <div className="flex md:flex-col gap-2 pt-4 md:pt-0 md:pl-4 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700 justify-center items-center">
                {hasPerm('manage_appointments') && (
                  <>
                    {c.status === 'pending' && (
                      <button onClick={() => handleStatus(c.id, 'assign')} className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 w-full">
                        Prendre en charge
                      </button>
                    )}
                    {c.status === 'assigned' && (
                      <button onClick={() => handleStatus(c.id, 'complete')} className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 w-full">
                        Clôturer
                      </button>
                    )}
                    {c.status !== 'completed' && c.status !== 'cancelled' && (
                      <button onClick={() => handleStatus(c.id, 'cancel')} className="px-4 py-2 bg-red-600/10 text-red-500 text-sm font-bold rounded-lg hover:bg-red-600/20 w-full">
                        Refuser
                      </button>
                    )}
                  </>
                )}
                
                {hasPerm('delete_appointments') && (
                  <button 
                    onClick={() => deleteComplaint(c.id)} 
                    className="p-2 text-slate-400 hover:text-red-500 transition-colors" 
                    title="Supprimer définitivement"
                  >
                    <Trash2 size={18}/>
                  </button>
                )}
              </div>
            </div>
          ))}
          {complaints.length === 0 && (
            <div className="text-center p-12 text-slate-400 font-medium bg-slate-800/50 rounded-xl border border-dashed border-slate-700">
              Aucune plainte à traiter
            </div>
          )}
        </div>
      )}
    </Layout>
  )
}

// ============================================================================
// ROSTER
// ============================================================================

function Roster() {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    apiFetch("/api/users/roster")
      .then(r => r.json())
      .then(d => setMembers(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [])
  
  const order = ["High Command", "Command Staff", "Supervisors", "Officers", "Système"];
  const grouped = members.reduce((acc, m) => {
    const cat = m.grade_category || "Autres";
    if(!acc[cat]) acc[cat] = [];
    acc[cat].push(m);
    return acc;
  }, {});

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </Layout>
    )
  }

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

// ============================================================================
// ADMIN (Version simplifiée pour garder le code court)
// ============================================================================

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
  
  const [gradeModal, setGradeModal] = useState(false)
  const [editingGrade, setEditingGrade] = useState(null)
  const [gradeForm, setGradeForm] = useState({ name: "", color: "", permissions: {} })

  const [form, setForm] = useState({ username: "", password: "", first_name: "", last_name: "", badge_number: "", grade_id: "", visible_grade_id: "" })

  const load = () => {
    if(activeTab === 'users' && hasPerm('manage_users')) {
      apiFetch("/api/admin/users").then(r => r.ok ? r.json() : []).then(setUsers);
    }
    if(activeTab === 'grades') {
      apiFetch("/api/admin/grades").then(r => r.ok ? r.json() : []).then(setGrades);
    }
    if(activeTab === 'logs' && hasPerm('view_logs')) {
      apiFetch("/api/admin/logs").then(r => r.ok ? r.json() : []).then(setLogs);
    }
    if(activeTab === 'performance' && hasPerm('view_logs')) {
      apiFetch("/api/admin/performance").then(r => r.ok ? r.json() : []).then(setPerformance);
    }
    apiFetch("/api/admin/grades").then(r => r.ok ? r.json() : []).then(setGrades);
  }
  useEffect(() => { load() }, [activeTab])

  const openCreateModal = () => {
    setForm({ username: "", password: "", first_name: "", last_name: "", badge_number: "", grade_id: "", visible_grade_id: "" });
    setIsEditing(false);
    setEditingId(null);
    setShowModal(true);
  }

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
  }

  const submitUser = async (e) => {
    e.preventDefault()
    let res;
    if (isEditing) {
      res = await apiFetch(`/api/admin/users/${editingId}`, { method: "PUT", body: JSON.stringify(form) })
    } else {
      res = await apiFetch("/api/admin/users", { method: "POST", body: JSON.stringify(form) })
    }
    
    if (res.ok) {
      setShowModal(false)
      load()
    } else {
      const err = await res.json()
      alert(err.error || "Erreur")
    }
  }
  
  const deleteUser = async (id) => {
    if (!hasPerm('delete_users')) {
      alert("Permission refusée")
      return
    }
    if(window.confirm("Renvoyer définitivement cet officier ?")) {
      const res = await apiFetch(`/api/admin/users/${id}`, { method: "DELETE" })
      if (res.ok) {
        load()
      } else {
        const err = await res.json()
        alert(err.error || "Erreur")
      }
    }
  }

  const editGrade = (g) => {
    if (!hasPerm('manage_grades')) {
      alert("Permission refusée")
      return
    }
    setEditingGrade(g);
    setGradeForm({
      name: g.name,
      color: g.color,
      permissions: g.permissions || {}
    });
    setGradeModal(true);
  }

  const saveGrade = async (e) => {
    e.preventDefault();
    const res = await apiFetch(`/api/admin/grades/${editingGrade.id}`, { method: "PUT", body: JSON.stringify(gradeForm) });
    if (res.ok) {
      setGradeModal(false);
      load();
    } else {
      const err = await res.json()
      alert(err.error || "Erreur")
    }
  }

  const togglePerm = (permKey) => {
    setGradeForm(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [permKey]: !prev.permissions[permKey]
      }
    }));
  }

  const allTabs = [
    { id: "users", label: "Utilisateurs", icon: Users, perm: "manage_users" },
    { id: "grades", label: "Grades & Perms", icon: Settings, perm: "manage_grades" },
    { id: "logs", label: "Logs", icon: ScrollText, perm: "view_logs" },
    { id: "performance", label: "Performance", icon: BarChart3, perm: "view_logs" }
  ]
  const tabs = allTabs.filter(t => hasPerm(t.perm))

  useEffect(() => {
    if (tabs.length > 0 && !tabs.find(t => t.id === activeTab)) {
      setActiveTab(tabs[0].id)
    }
  }, [tabs, activeTab])

  return (
    <Layout>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-black text-slate-900 dark:text-white">ADMINISTRATION</h1>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-colors whitespace-nowrap ${activeTab === t.id ? "bg-blue-600 text-white" : "bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"}`}>
            <t.icon size={16}/> {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
        {activeTab === "users" && hasPerm('manage_users') && (
          <>
            <div className="p-4 border-b dark:border-slate-700 flex justify-end">
              <button onClick={openCreateModal} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700">
                <UserPlus size={16}/> Ajouter
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-100 dark:bg-slate-900 text-xs uppercase font-bold text-slate-500">
                  <tr>
                    <th className="px-6 py-4">Officier</th>
                    <th className="px-6 py-4">Grade</th>
                    <th className="px-6 py-4">Matricule</th>
                    <th className="px-6 py-4">Statut</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {users.map(u => (
                    <tr key={u.id} className={!u.is_active ? "opacity-50" : ""}>
                      <td className="px-6 py-4 font-bold text-slate-800 dark:text-white">{u.first_name} {u.last_name}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 rounded text-xs font-medium" style={{backgroundColor: u.grade_color + '20', color: u.grade_color}}>
                          {u.grade_name}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-500">{u.badge_number}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${u.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                          {u.is_active ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right flex justify-end gap-2">
                        <button onClick={() => openEditModal(u)} className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors" title="Modifier">
                          <Pencil size={16} />
                        </button>
                        {u.id !== user.id && hasPerm('delete_users') && (
                          <button onClick={() => deleteUser(u.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors" title="Supprimer">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        
        {activeTab === "grades" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-100 dark:bg-slate-900 text-xs uppercase font-bold text-slate-500">
                <tr>
                  <th className="px-6 py-4">Grade</th>
                  <th className="px-6 py-4">Niveau</th>
                  <th className="px-6 py-4">Permissions</th>
                  {hasPerm('manage_grades') && <th className="px-6 py-4 text-right">Modifier</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {grades.map(g => (
                  <tr key={g.id}>
                    <td className="px-6 py-4 font-bold flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{background: g.color}}></div>
                      <span className="text-slate-800 dark:text-white">{g.name}</span>
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-500">{g.level}</td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {Object.keys(g.permissions || {}).filter(k => g.permissions[k]).length} / {PERMISSIONS_LIST.length} droits
                    </td>
                    {hasPerm('manage_grades') && (
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => editGrade(g)} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-xs font-bold">
                          Configurer
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "logs" && hasPerm('view_logs') && (
          <div className="max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-100 dark:bg-slate-900 text-xs uppercase font-bold text-slate-500 sticky top-0">
                <tr>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Utilisateur</th>
                  <th className="px-6 py-4">Action</th>
                  <th className="px-6 py-4">Détails</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {logs.map((l, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4 text-slate-500 whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                    <td className="px-6 py-4 font-bold">{l.first_name} {l.last_name}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        l.action?.includes('DELETE') ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                        l.action?.includes('CREATE') ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                        'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                      }`}>
                        {l.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300 max-w-md truncate">{l.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {activeTab === "performance" && hasPerm('view_logs') && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-100 dark:bg-slate-900 text-xs uppercase font-bold text-slate-500">
                <tr>
                  <th className="px-6 py-4">Officier</th>
                  <th className="px-6 py-4 text-center">Plaintes Traitées</th>
                  <th className="px-6 py-4 text-center">Actions Totales</th>
                </tr>
              </thead>
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
          </div>
        )}
      </div>

      {/* Modal Utilisateur */}
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
              <InputField label="Matricule" value={form.badge_number} onChange={e => setForm({...form, badge_number: e.target.value})} />
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

      {/* Modal Grades */}
      {gradeModal && editingGrade && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg p-6 rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              Configuration: {editingGrade.name}
            </h2>
            <form onSubmit={saveGrade} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <InputField label="Nom du Grade" value={gradeForm.name} onChange={e => setGradeForm({...gradeForm, name: e.target.value})} />
                <div className="mb-3">
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-slate-500 dark:text-slate-400">Couleur</label>
                  <input 
                    type="color" 
                    className="w-full h-10 rounded-md cursor-pointer border border-slate-300 dark:border-slate-600" 
                    value={gradeForm.color} 
                    onChange={e => setGradeForm({...gradeForm, color: e.target.value})} 
                  />
                </div>
              </div>
              
              <div className="pt-2 border-t dark:border-slate-700">
                <p className="text-xs font-bold text-slate-500 uppercase mb-3">Permissions d'accès</p>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                  {PERMISSIONS_LIST.map(p => (
                    <label key={p.key} className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-600 transition-all">
                      <input 
                        type="checkbox" 
                        checked={!!gradeForm.permissions[p.key]} 
                        onChange={() => togglePerm(p.key)}
                        className="w-4 h-4 mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{p.label}</span>
                        <p className="text-xs text-slate-500">{p.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setGradeModal(false)} className="flex-1 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white font-bold rounded-lg">Annuler</button>
                <button type="submit" className="flex-1 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">Sauvegarder</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}

// ============================================================================
// PUBLIC PAGES
// ============================================================================

function PublicComplaint() {
  const [form, setForm] = useState({ patient_name: "", patient_phone: "", patient_discord: "", appointment_type: "Vol", description: "" })
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  
  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch("/api/appointments/public", { 
        method: "POST", 
        headers: {"Content-Type":"application/json"}, 
        body: JSON.stringify(form) 
      })
      if (res.ok) {
        setDone(true)
      } else {
        const err = await res.json()
        alert(err.error || "Erreur lors de l'envoi")
      }
    } catch {
      alert("Erreur de connexion")
    }
    setLoading(false)
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
            <InputField label="Téléphone" placeholder="555-0100" value={form.patient_phone} onChange={e => setForm({...form, patient_phone: e.target.value})} />
            <InputField label="Discord" placeholder="pseudo#0000" value={form.patient_discord} onChange={e => setForm({...form, patient_discord: e.target.value})} />
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
            <button type="submit" disabled={loading} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <><Send size={18}/> Envoyer</>}
            </button>
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
  const [loading, setLoading] = useState(false)
  
  const submit = async (e) => {
    e.preventDefault()
    setErr("")
    setLoading(true)
    const res = await login(form.username, form.password)
    setLoading(false)
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
          <button type="submit" disabled={loading} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors shadow-lg shadow-blue-900/50 disabled:opacity-50">
            {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"/> : "CONNEXION"}
          </button>
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

// ============================================================================
// APP
// ============================================================================

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
            <Route path="/centrale" element={<ProtectedRoute><Centrale /></ProtectedRoute>} />
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

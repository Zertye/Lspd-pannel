import { BrowserRouter, Routes, Route, Navigate, useLocation, Link, useNavigate } from "react-router-dom"
import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react"
import { 
  Shield, Users, ClipboardList, ShieldAlert, LogOut, LayoutDashboard, Menu, X, 
  CheckCircle, Send, Phone, Lock, AlertTriangle, FileText, Activity,
  BarChart3, ScrollText, ChevronRight, UserPlus, User, Camera, Pencil, Trash2, Settings,
  Radio, PlayCircle, StopCircle, MapPin, Car, Clock, Star, Plus, MessageSquare,
  AlertCircle, Siren, PhoneCall, Pin, ChevronDown, Crown, Headphones, UserCheck,
  Timer, Zap, Navigation, CircleDot, RefreshCw, ChevronUp, Eye, EyeOff
} from "lucide-react"

// ============================================================================
// CONSTANTES
// ============================================================================
const PERMISSIONS_LIST = [
  { key: "access_dashboard", label: "Acces Dashboard", description: "Voir le tableau de bord" },
  { key: "view_roster", label: "Voir Effectifs", description: "Consulter la liste des officiers" },
  { key: "manage_appointments", label: "Gerer Plaintes", description: "Assigner, cloturer, refuser les plaintes" },
  { key: "delete_appointments", label: "Supprimer Plaintes", description: "Supprimer definitivement les plaintes" },
  { key: "manage_users", label: "Gerer Utilisateurs", description: "Creer et modifier les officiers" },
  { key: "delete_users", label: "Exclure Officiers", description: "Supprimer definitivement les officiers" },
  { key: "manage_grades", label: "Gerer Grades", description: "Modifier les grades et permissions" },
  { key: "view_logs", label: "Voir les Logs", description: "Acceder aux journaux d audit" },
  { key: "force_end_service", label: "Forcer Fin Service", description: "Forcer la mise hors service d un officier" }
];

const PATROL_STATUSES = [
  { id: "available", label: "Disponible", color: "emerald", icon: CheckCircle },
  { id: "busy", label: "Occupe", color: "amber", icon: AlertCircle },
  { id: "emergency", label: "Urgence", color: "red", icon: Siren },
  { id: "break", label: "Pause", color: "slate", icon: Clock },
  { id: "offline", label: "Hors service", color: "gray", icon: X }
];

const CALL_TYPES = [
  { id: "vol", label: "Vol / Cambriolage", priority: 1 },
  { id: "agression", label: "Agression", priority: 2 },
  { id: "accident", label: "Accident de la route", priority: 1 },
  { id: "tapage", label: "Tapage / Nuisances", priority: 0 },
  { id: "suspect", label: "Individu suspect", priority: 1 },
  { id: "poursuite", label: "Course-poursuite", priority: 2 },
  { id: "arme", label: "Arme a feu", priority: 2 },
  { id: "autre", label: "Autre intervention", priority: 0 }
];

// ============================================================================
// AUTH CONTEXT - JWT PERSISTANT
// ============================================================================
const AuthContext = createContext(null)
export function useAuth() { return useContext(AuthContext) }

const TOKEN_KEY = "lspd_auth_token";
const TOKEN_EXPIRY_KEY = "lspd_token_expiry";

const isTokenExpired = () => {
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  if (!expiry) return true;
  return new Date().getTime() > parseInt(expiry);
};

export const apiFetch = async (url, options = {}) => {
  const token = localStorage.getItem(TOKEN_KEY);
  
  if (token && isTokenExpired()) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    window.location.href = "/login";
    return;
  }
  
  const headers = { ...options.headers };
  if (token) headers["Authorization"] = "Bearer " + token;
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  
  const response = await fetch(url, { ...options, headers });
  
  if (response.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    window.location.href = "/login";
    return response;
  }
  
  return response;
};

function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authChecked, setAuthChecked] = useState(false)

  const verifyToken = useCallback(async () => {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      
      if (!token || isTokenExpired()) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(TOKEN_EXPIRY_KEY);
        setUser(null);
        setLoading(false);
        setAuthChecked(true);
        return;
      }

      const response = await fetch("/api/auth/me", {
        headers: { "Authorization": "Bearer " + token }
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(TOKEN_EXPIRY_KEY);
        setUser(null);
      }
    } catch (e) {
      console.error("Auth verification failed:", e);
      setUser(null);
    }
    setLoading(false);
    setAuthChecked(true);
  }, []);

  useEffect(() => {
    verifyToken();
    
    const interval = setInterval(() => {
      if (isTokenExpired()) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(TOKEN_EXPIRY_KEY);
        setUser(null);
        window.location.href = "/login";
      }
    }, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [verifyToken]);

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
        const expiryTime = new Date().getTime() + (7 * 24 * 60 * 60 * 1000);
        localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
        setUser(data.user);
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch (e) {
      return { success: false, error: "Erreur de connexion au serveur" };
    }
  }

  const logout = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch (e) {}
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    setUser(null);
    window.location.href = "/";
  }

  const hasPerm = (perm) => {
    if (!user) return false;
    if (user.grade_level === 99) return true;
    if (user.is_admin === true) return true;
    return user.grade_permissions && user.grade_permissions[perm] === true;
  };

  const refreshUser = async () => {
    await verifyToken();
  };

  return (
    <AuthContext.Provider value={{ user, loading, authChecked, login, logout, hasPerm, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

// ============================================================================
// UI COMPONENTS
// ============================================================================
const InputField = ({ label, error, ...props }) => (
  <div className="mb-4">
    {label && (
      <label className="block text-xs font-semibold uppercase tracking-wide mb-2 text-slate-600 dark:text-slate-400">
        {label}
      </label>
    )}
    <input 
      className={"w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-800 border " + (error ? "border-red-500" : "border-slate-300 dark:border-slate-600") + " focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors text-slate-900 dark:text-white rounded"}
      {...props} 
    />
    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
  </div>
)

const SelectField = ({ label, children, ...props }) => (
  <div className="mb-4">
    {label && (
      <label className="block text-xs font-semibold uppercase tracking-wide mb-2 text-slate-600 dark:text-slate-400">
        {label}
      </label>
    )}
    <select 
      className="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors text-slate-900 dark:text-white rounded appearance-none cursor-pointer"
      {...props}
    >
      {children}
    </select>
  </div>
)

const TextArea = ({ label, ...props }) => (
  <div className="mb-4">
    {label && (
      <label className="block text-xs font-semibold uppercase tracking-wide mb-2 text-slate-600 dark:text-slate-400">
        {label}
      </label>
    )}
    <textarea 
      className="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors text-slate-900 dark:text-white min-h-[100px] resize-none rounded"
      {...props} 
    />
  </div>
)

const Button = ({ variant = "primary", size = "md", children, className = "", ...props }) => {
  const variants = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white",
    secondary: "bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-white",
    danger: "bg-red-600 hover:bg-red-700 text-white",
    success: "bg-emerald-600 hover:bg-emerald-700 text-white",
    ghost: "bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };
  return (
    <button 
      className={"font-medium transition-colors rounded " + variants[variant] + " " + sizes[size] + " " + className}
      {...props}
    >
      {children}
    </button>
  );
};

const Badge = ({ variant = "default", children, className = "" }) => {
  const variants = {
    default: "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300",
    success: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
    warning: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
    danger: "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400",
    info: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  };
  return (
    <span className={"inline-flex items-center px-2 py-0.5 text-xs font-medium rounded " + variants[variant] + " " + className}>
      {children}
    </span>
  );
};

const Card = ({ children, className = "", noPadding = false }) => (
  <div className={"bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded " + (noPadding ? "" : "p-5 ") + className}>
    {children}
  </div>
);

const StatCard = ({ label, value, icon: Icon, color = "blue", subtitle }) => {
  const colors = {
    blue: "text-blue-600 bg-blue-50 dark:bg-blue-900/20",
    green: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20",
    yellow: "text-amber-600 bg-amber-50 dark:bg-amber-900/20",
    red: "text-red-600 bg-red-50 dark:bg-red-900/20",
    purple: "text-purple-600 bg-purple-50 dark:bg-purple-900/20",
  };
  return (
    <Card className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{value}</p>
        {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
      </div>
      <div className={"p-2.5 rounded " + colors[color]}>
        <Icon size={20}/>
      </div>
    </Card>
  );
};

const formatDuration = (seconds) => {
  if (!seconds || seconds < 0) return "0m";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return hours + "h " + minutes + "m";
  return minutes + "m";
};

const formatDurationLong = (seconds) => {
  if (!seconds || seconds < 0) return "0 minutes";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return hours + "h " + minutes + "min";
  return minutes + "min";
};

// ============================================================================
// LAYOUT
// ============================================================================
function SidebarItem({ icon: Icon, label, to, active, badge }) {
  return (
    <Link 
      to={to} 
      className={"flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors rounded " + (active ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white")}
    >
      <Icon size={18} strokeWidth={1.5} />
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="px-1.5 py-0.5 text-xs font-bold bg-red-500 text-white rounded">
          {badge}
        </span>
      )}
    </Link>
  );
}

function Modal({ title, children, onClose, size = "md" }) {
  const sizes = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
  };
  
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className={"bg-white dark:bg-slate-800 w-full " + sizes[size] + " rounded border border-slate-200 dark:border-slate-700 shadow-xl"}>
        <div className="flex justify-between items-center px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
            <X size={20}/>
          </button>
        </div>
        <div className="p-5">
          {children}
        </div>
      </div>
    </div>
  );
}

function Layout({ children }) {
  const { user, logout, hasPerm, refreshUser } = useAuth()
  const location = useLocation()
  const [mobileMenu, setMobileMenu] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [serviceStatus, setServiceStatus] = useState(null)
  
  const [profileForm, setProfileForm] = useState({ 
    first_name: "", last_name: "", phone: "", password: "", profile_picture: null 
  })
  const fileInputRef = useRef(null)

  useEffect(() => {
    const checkService = async () => {
      try {
        const res = await apiFetch("/api/centrale/service/status")
        if (res && res.ok) {
          const data = await res.json()
          setServiceStatus(data)
        }
      } catch (e) {}
    }
    checkService()
    const interval = setInterval(checkService, 30000)
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
    if (profileForm.profile_picture instanceof File) {
      formData.append("profile_picture", profileForm.profile_picture)
    }
    
    const res = await apiFetch("/api/users/me", { method: "PUT", body: formData })
    if (res && res.ok) {
      await refreshUser()
      setShowProfile(false)
    } else {
      const err = res ? await res.json() : {}
      alert(err.error || "Erreur lors de la mise a jour")
    }
  }

  const navs = [
    { icon: LayoutDashboard, label: "Dashboard", to: "/dashboard", perm: "access_dashboard" },
    { icon: Radio, label: "Centrale", to: "/centrale", perm: "access_dashboard" },
    { icon: ClipboardList, label: "Plaintes", to: "/plaintes", perm: "access_dashboard" },
    { icon: Users, label: "Effectifs", to: "/roster", perm: "view_roster" },
  ]
  
  if (hasPerm("manage_users") || hasPerm("view_logs") || hasPerm("manage_grades") || hasPerm("delete_users")) {
    navs.push({ icon: Settings, label: "Administration", to: "/admin" })
  }

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
      <aside className="hidden lg:flex flex-col w-60 bg-slate-900 border-r border-slate-800 fixed h-full z-30">
        <div className="p-5 flex items-center gap-3 border-b border-slate-800">
          <div className="w-9 h-9 bg-blue-600 rounded flex items-center justify-center">
            <Shield className="text-white" size={20} strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-white font-bold text-sm tracking-wide">LSPD MDT</h1>
            <p className="text-slate-500 text-xs">Intranet v2.0</p>
          </div>
        </div>

        <div className="px-4 py-3 border-b border-slate-800">
          {serviceStatus && serviceStatus.isOnDuty ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-900/20 border border-emerald-800 rounded text-xs">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-emerald-400 font-medium">En service</span>
              <span className="text-emerald-600 ml-auto font-mono">
                {formatDuration(serviceStatus.service ? serviceStatus.service.current_duration : 0)}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-xs">
              <div className="w-2 h-2 bg-slate-500 rounded-full"></div>
              <span className="text-slate-400 font-medium">Hors service</span>
            </div>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navs.filter(function(n) { return !n.perm || hasPerm(n.perm) }).map(function(n) {
            return <SidebarItem key={n.to} icon={n.icon} label={n.label} to={n.to} active={location.pathname === n.to} />
          })}
        </nav>
        
        <div className="p-3 bg-slate-950 border-t border-slate-800">
          <button 
            onClick={openProfile} 
            className="flex items-center gap-3 w-full text-left hover:bg-slate-900 p-2 rounded transition-colors group"
          >
            <div className="w-9 h-9 rounded bg-slate-800 flex items-center justify-center font-medium text-white border border-slate-700 overflow-hidden text-sm">
              {user && user.profile_picture ? (
                <img src={user.profile_picture} className="w-full h-full object-cover"/>
              ) : (user && user.first_name ? user.first_name[0] : "?")}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-sm font-medium text-white truncate group-hover:text-blue-400 transition-colors">
                {user ? user.first_name : ""} {user ? user.last_name : ""}
              </p>
              <p className="text-xs text-slate-500 truncate">{user ? user.grade_name : ""}</p>
            </div>
          </button>
          <button 
            onClick={logout} 
            className="w-full flex items-center justify-center gap-2 py-2 mt-2 rounded bg-slate-800 text-slate-400 hover:text-red-400 hover:bg-slate-800/80 text-xs font-medium transition-colors"
          >
            <LogOut size={14} /> Deconnexion
          </button>
        </div>
      </aside>

      <main className="flex-1 lg:ml-60 flex flex-col min-h-screen">
        <header className="lg:hidden h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded flex items-center justify-center">
              <Shield className="text-white" size={16} />
            </div>
            <span className="font-bold text-white text-sm">LSPD MDT</span>
          </div>
          <div className="flex items-center gap-3">
            {serviceStatus && serviceStatus.isOnDuty && (
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            )}
            <button onClick={function() { setMobileMenu(!mobileMenu) }} className="text-white">
              <Menu size={20}/>
            </button>
          </div>
        </header>
        
        {mobileMenu && (
          <div className="fixed inset-0 bg-slate-900 z-50 p-4 lg:hidden">
            <div className="flex justify-between items-center mb-6">
              <span className="text-white font-bold">Menu</span>
              <button onClick={function() { setMobileMenu(false) }} className="text-white">
                <X size={20}/>
              </button>
            </div>
            <nav className="space-y-2">
              {navs.filter(function(n) { return !n.perm || hasPerm(n.perm) }).map(function(n) {
                return (
                  <Link 
                    key={n.to} 
                    to={n.to} 
                    onClick={function() { setMobileMenu(false) }} 
                    className="flex items-center gap-3 p-3 rounded bg-slate-800 text-white font-medium"
                  >
                    <n.icon size={18}/> {n.label}
                  </Link>
                )
              })}
              <button 
                onClick={logout} 
                className="w-full flex items-center gap-3 p-3 rounded bg-red-900/20 text-red-400 font-medium mt-4"
              >
                <LogOut size={18}/> Deconnexion
              </button>
            </nav>
          </div>
        )}
        
        <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>

      {showProfile && (
        <Modal title="Profil Officier" onClose={function() { setShowProfile(false) }}>
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="flex justify-center mb-6">
              <div 
                className="w-20 h-20 rounded bg-slate-200 dark:bg-slate-700 relative group cursor-pointer overflow-hidden border-2 border-slate-300 dark:border-slate-600 hover:border-blue-500 transition-colors"
                onClick={function() { fileInputRef.current.click() }}
              >
                {profileForm.profile_picture instanceof File ? (
                  <img src={URL.createObjectURL(profileForm.profile_picture)} className="w-full h-full object-cover" />
                ) : user && user.profile_picture ? (
                  <img src={user.profile_picture} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                    <User size={32}/>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="text-white" size={20}/>
                </div>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={function(e) { setProfileForm({...profileForm, profile_picture: e.target.files[0]}) }} 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <InputField 
                label="Prenom" 
                value={profileForm.first_name} 
                onChange={function(e) { setProfileForm({...profileForm, first_name: e.target.value}) }} 
              />
              <InputField 
                label="Nom" 
                value={profileForm.last_name} 
                onChange={function(e) { setProfileForm({...profileForm, last_name: e.target.value}) }} 
              />
            </div>
            <InputField 
              label="Telephone" 
              value={profileForm.phone} 
              onChange={function(e) { setProfileForm({...profileForm, phone: e.target.value}) }} 
            />
            
            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
              <InputField 
                label="Nouveau mot de passe" 
                type="password" 
                placeholder="Laisser vide si inchange" 
                value={profileForm.password} 
                onChange={function(e) { setProfileForm({...profileForm, password: e.target.value}) }} 
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                type="button" 
                variant="secondary" 
                onClick={function() { setShowProfile(false) }} 
                className="flex-1"
              >
                Annuler
              </Button>
              <Button type="submit" className="flex-1">
                Enregistrer
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

// ============================================================================
// DASHBOARD
// ============================================================================
function Dashboard() {
  const { user, hasPerm } = useAuth()
  const [myStats, setMyStats] = useState(null)
  const [serviceStatus, setServiceStatus] = useState(null)
  const [patrolTimes, setPatrolTimes] = useState([])
  const [recentActivity, setRecentActivity] = useState([])
  const [loading, setLoading] = useState(true)

  const isAdmin = hasPerm("view_logs")

  useEffect(() => {
    const loadData = async () => {
      try {
        const statsRes = await apiFetch("/api/users/me/stats")
        if (statsRes && statsRes.ok) setMyStats(await statsRes.json())

        const serviceRes = await apiFetch("/api/centrale/service/status")
        if (serviceRes && serviceRes.ok) setServiceStatus(await serviceRes.json())

        if (isAdmin) {
          const patrolRes = await apiFetch("/api/centrale/patrol-times")
          if (patrolRes && patrolRes.ok) setPatrolTimes(await patrolRes.json())

          const activityRes = await apiFetch("/api/admin/logs?limit=10")
          if (activityRes && activityRes.ok) setRecentActivity(await activityRes.json())
        }
      } catch (e) {
        console.error("Dashboard load error:", e)
      }
      setLoading(false)
    }
    loadData()
  }, [isAdmin])

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Bienvenue, {user ? user.first_name : ""}
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {user ? user.grade_name : ""} - Matricule {user && user.badge_number ? user.badge_number : "N/A"}
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard 
          label="Plaintes traitees" 
          value={myStats ? myStats.my_appointments || 0 : 0} 
          icon={ClipboardList} 
          color="blue" 
        />
        <StatCard 
          label="Temps de patrouille" 
          value={formatDuration(user ? user.total_patrol_time || 0 : 0)} 
          icon={Timer} 
          color="green" 
        />
        <StatCard 
          label="Statut" 
          value={serviceStatus && serviceStatus.isOnDuty ? "En service" : "Hors service"} 
          icon={Radio} 
          color={serviceStatus && serviceStatus.isOnDuty ? "green" : "yellow"} 
        />
        <StatCard 
          label="Patrouille" 
          value={serviceStatus && serviceStatus.patrol ? serviceStatus.patrol.name : "Aucune"} 
          icon={Car} 
          color="purple" 
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
            Ma Patrouille
          </h2>
          
          {serviceStatus && serviceStatus.isOnDuty ? (
            serviceStatus.patrol ? (
              <div className="flex items-center gap-4">
                <div className={"w-12 h-12 rounded flex items-center justify-center " + (
                  serviceStatus.patrol.status === "emergency" ? "bg-red-50 dark:bg-red-900/20" :
                  serviceStatus.patrol.status === "busy" ? "bg-amber-50 dark:bg-amber-900/20" :
                  "bg-emerald-50 dark:bg-emerald-900/20"
                )}>
                  <Car size={24} className={
                    serviceStatus.patrol.status === "emergency" ? "text-red-600" :
                    serviceStatus.patrol.status === "busy" ? "text-amber-600" :
                    "text-emerald-600"
                  }/>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-900 dark:text-white">{serviceStatus.patrol.name}</p>
                  {serviceStatus.patrol.call_sign && (
                    <p className="text-blue-600 font-mono text-sm">{serviceStatus.patrol.call_sign}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    {serviceStatus.patrol.sector && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <MapPin size={12}/> {serviceStatus.patrol.sector}
                      </span>
                    )}
                    <Badge variant={
                      serviceStatus.patrol.status === "emergency" ? "danger" :
                      serviceStatus.patrol.status === "busy" ? "warning" : "success"
                    }>
                      {serviceStatus.patrol.status === "emergency" ? "URGENCE" :
                       serviceStatus.patrol.status === "busy" ? "OCCUPE" : "DISPONIBLE"}
                    </Badge>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <AlertCircle size={32} className="text-amber-500 mx-auto mb-2"/>
                <p className="text-slate-600 dark:text-slate-300 font-medium">Aucune patrouille assignee</p>
                <Link to="/centrale" className="text-blue-600 text-sm hover:underline mt-1 inline-block">
                  Rejoindre une patrouille
                </Link>
              </div>
            )
          ) : (
            <div className="text-center py-6">
              <Radio size={32} className="text-slate-400 mx-auto mb-2"/>
              <p className="text-slate-500 font-medium">Hors service</p>
              <Link to="/centrale" className="text-blue-600 text-sm hover:underline mt-1 inline-block">
                Prendre son service
              </Link>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
            Actions Rapides
          </h2>
          <div className="space-y-2">
            <Link 
              to="/centrale" 
              className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <Radio size={18} className="text-blue-600"/>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Ouvrir la Centrale</span>
              <ChevronRight size={16} className="ml-auto text-slate-400"/>
            </Link>
            <Link 
              to="/plaintes" 
              className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <ClipboardList size={18} className="text-amber-600"/>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Gerer les Plaintes</span>
              <ChevronRight size={16} className="ml-auto text-slate-400"/>
            </Link>
            <Link 
              to="/roster" 
              className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <Users size={18} className="text-purple-600"/>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Voir les Effectifs</span>
              <ChevronRight size={16} className="ml-auto text-slate-400"/>
            </Link>
          </div>
        </Card>
      </div>

      {isAdmin && (
        <div className="grid lg:grid-cols-3 gap-6 mt-6">
          <Card noPadding className="lg:col-span-2 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Timer size={18} className="text-blue-600"/>
                Classement Temps de Patrouille
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase font-medium text-slate-500">
                  <tr>
                    <th className="px-5 py-3 text-left">#</th>
                    <th className="px-5 py-3 text-left">Officier</th>
                    <th className="px-5 py-3 text-left">Grade</th>
                    <th className="px-5 py-3 text-right">Temps Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {patrolTimes.slice(0, 8).map(function(p, i) {
                    return (
                      <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-5 py-3 w-12">
                          {i === 0 ? <Crown size={16} className="text-amber-500"/> :
                           <span className="text-slate-400 font-medium">{i + 1}</span>}
                        </td>
                        <td className="px-5 py-3 font-medium text-slate-800 dark:text-white">
                          {p.first_name} {p.last_name}
                        </td>
                        <td className="px-5 py-3">
                          <span 
                            className="px-2 py-1 rounded text-xs font-medium"
                            style={{backgroundColor: p.grade_color + "15", color: p.grade_color}}
                          >
                            {p.grade_name}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-slate-600 dark:text-slate-300">
                          {formatDurationLong(p.total_patrol_time || 0)}
                        </td>
                      </tr>
                    )
                  })}
                  {patrolTimes.length === 0 && (
                    <tr>
                      <td colSpan="4" className="px-5 py-8 text-center text-slate-400">
                        Aucune donnee
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card noPadding className="overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Activity size={18} className="text-purple-600"/>
                Activite Recente
              </h2>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {recentActivity.length > 0 ? (
                <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {recentActivity.map(function(log, i) {
                    return (
                      <div key={i} className="px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <div className="flex items-start gap-3">
                          <div className={"w-7 h-7 rounded flex items-center justify-center flex-shrink-0 " + (
                            log.action && log.action.includes("DELETE") ? "bg-red-50 dark:bg-red-900/20 text-red-600" :
                            log.action && log.action.includes("CREATE") ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600" :
                            "bg-blue-50 dark:bg-blue-900/20 text-blue-600"
                          )}>
                            {log.action && log.action.includes("DELETE") ? <Trash2 size={14}/> :
                             log.action && log.action.includes("CREATE") ? <Plus size={14}/> :
                             <Pencil size={14}/>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-800 dark:text-white font-medium truncate">
                              {log.first_name} {log.last_name}
                            </p>
                            <p className="text-xs text-slate-500 truncate">{log.action}</p>
                          </div>
                          <span className="text-xs text-slate-400 flex-shrink-0">
                            {new Date(log.created_at).toLocaleTimeString("fr-FR", {
                              hour: "2-digit", minute: "2-digit"
                            })}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="px-5 py-8 text-center text-slate-400">
                  Aucune activite
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </Layout>
  )
}

// ============================================================================
// CENTRALE
// ============================================================================
function Centrale() {
  const { user, hasPerm } = useAuth()
  const [serviceStatus, setServiceStatus] = useState(null)
  const [onlineOfficers, setOnlineOfficers] = useState([])
  const [patrols, setPatrols] = useState([])
  const [notes, setNotes] = useState([])
  const [dispatches, setDispatches] = useState([])
  const [currentOperator, setCurrentOperator] = useState(null)
  const [loading, setLoading] = useState(true)
  
  const [showPatrolModal, setShowPatrolModal] = useState(false)
  const [showDispatchModal, setShowDispatchModal] = useState(false)
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [editingPatrol, setEditingPatrol] = useState(null)
  const [selectedPatrol, setSelectedPatrol] = useState(null)
  
  const [patrolForm, setPatrolForm] = useState({ name: "", call_sign: "", vehicle: "", sector: "", notes: "" })
  const [dispatchForm, setDispatchForm] = useState({ call_type: "", location: "", description: "", priority: 0, patrol_id: "" })
  const [noteForm, setNoteForm] = useState({ content: "", note_type: "info", patrol_id: "", is_pinned: false })

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

      if (statusRes && statusRes.ok) setServiceStatus(await statusRes.json())
      if (onlineRes && onlineRes.ok) {
        const data = await onlineRes.json()
        setOnlineOfficers(data.officers || [])
      }
      if (patrolsRes && patrolsRes.ok) setPatrols(await patrolsRes.json())
      if (notesRes && notesRes.ok) setNotes(await notesRes.json())
      if (dispatchRes && dispatchRes.ok) setDispatches(await dispatchRes.json())
      if (operatorRes && operatorRes.ok) {
        const data = await operatorRes.json()
        setCurrentOperator(data.operator)
      }
    } catch (e) {
      console.error("Centrale load error:", e)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 15000)
    return () => clearInterval(interval)
  }, [loadData])

  const startService = async () => {
    const res = await apiFetch("/api/centrale/service/start", { method: "POST" })
    if (res && res.ok) loadData()
    else {
      const err = res ? await res.json() : {}
      alert(err.error || "Erreur")
    }
  }

  const endService = async () => {
    if (!window.confirm("Terminer votre service ?")) return
    const res = await apiFetch("/api/centrale/service/end", { method: "POST" })
    if (res && res.ok) loadData()
  }

  const openCreatePatrol = () => {
    setPatrolForm({ name: "", call_sign: "", vehicle: "", sector: "", notes: "" })
    setEditingPatrol(null)
    setShowPatrolModal(true)
  }

  const openEditPatrol = (patrol) => {
    setPatrolForm({
      name: patrol.name,
      call_sign: patrol.call_sign || "",
      vehicle: patrol.vehicle || "",
      sector: patrol.sector || "",
      notes: patrol.notes || ""
    })
    setEditingPatrol(patrol)
    setShowPatrolModal(true)
  }

  const savePatrol = async (e) => {
    e.preventDefault()
    const method = editingPatrol ? "PUT" : "POST"
    const url = editingPatrol ? "/api/centrale/patrols/" + editingPatrol.id : "/api/centrale/patrols"
    
    const res = await apiFetch(url, { method: method, body: JSON.stringify(patrolForm) })
    if (res && res.ok) {
      setShowPatrolModal(false)
      loadData()
    }
  }

  const deletePatrol = async (id) => {
    if (!window.confirm("Supprimer cette patrouille ?")) return
    await apiFetch("/api/centrale/patrols/" + id, { method: "DELETE" })
    loadData()
  }

  const updatePatrolStatus = async (patrolId, status) => {
    await apiFetch("/api/centrale/patrols/" + patrolId, { 
      method: "PUT", 
      body: JSON.stringify({ status: status }) 
    })
    loadData()
  }

  const openAssignModal = (patrol) => {
    setSelectedPatrol(patrol)
    setShowAssignModal(true)
  }

  const assignOfficer = async (userId) => {
    await apiFetch("/api/centrale/patrols/" + selectedPatrol.id + "/assign", {
      method: "POST",
      body: JSON.stringify({ userId: userId })
    })
    loadData()
  }

  const unassignOfficer = async (patrolId, odUserId) => {
    await apiFetch("/api/centrale/patrols/" + patrolId + "/unassign", {
      method: "POST",
      body: JSON.stringify({ userId: odUserId })
    })
    loadData()
  }

  const setLeader = async (patrolId, odUserId) => {
    await apiFetch("/api/centrale/patrols/" + patrolId + "/leader", {
      method: "POST",
      body: JSON.stringify({ userId: odUserId })
    })
    loadData()
  }

  const assignOperator = async (odUserId) => {
    await apiFetch("/api/centrale/operator/assign", {
      method: "POST",
      body: JSON.stringify({ userId: odUserId })
    })
    loadData()
  }

  const forceEndService = async (odUserId, officerName) => {
    if (!window.confirm("Forcer la fin de service de " + officerName + " ?")) return
    await apiFetch("/api/centrale/service/force-end", {
      method: "POST",
      body: JSON.stringify({ userId: odUserId })
    })
    loadData()
  }

  const saveNote = async (e) => {
    e.preventDefault()
    await apiFetch("/api/centrale/notes", { method: "POST", body: JSON.stringify(noteForm) })
    setShowNoteModal(false)
    setNoteForm({ content: "", note_type: "info", patrol_id: "", is_pinned: false })
    loadData()
  }

  const deleteNote = async (id) => {
    await apiFetch("/api/centrale/notes/" + id, { method: "DELETE" })
    loadData()
  }

  const togglePinNote = async (id) => {
    await apiFetch("/api/centrale/notes/" + id + "/pin", { method: "POST" })
    loadData()
  }

  const saveDispatch = async (e) => {
    e.preventDefault()
    await apiFetch("/api/centrale/dispatch", { method: "POST", body: JSON.stringify(dispatchForm) })
    setShowDispatchModal(false)
    setDispatchForm({ call_type: "", location: "", description: "", priority: 0, patrol_id: "" })
    loadData()
  }

  const updateDispatchStatus = async (id, status) => {
    await apiFetch("/api/centrale/dispatch/" + id + "/status", {
      method: "POST",
      body: JSON.stringify({ status: status })
    })
    loadData()
  }

  const availableOfficers = onlineOfficers.filter(function(o) { return !o.patrol_id })

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </Layout>
    )
  }

  if (!serviceStatus || !serviceStatus.isOnDuty) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 bg-slate-800 rounded flex items-center justify-center mb-6 border border-slate-700">
            <Radio size={32} className="text-slate-500"/>
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Centrale LSPD</h1>
          <p className="text-slate-500 mb-8 text-center max-w-md text-sm">
            Prenez votre service pour acceder a la centrale et aux patrouilles.
          </p>
          <Button onClick={startService} size="lg" className="flex items-center gap-2">
            <PlayCircle size={20}/>
            Prendre son service
          </Button>
        </div>
      </Layout>
    )
  }

  const canManage = serviceStatus.canManageCentrale || (user && user.grade_level === 99)

  return (
    <Layout>
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Radio className="text-purple-600" size={24}/>
            Centrale
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {onlineOfficers.length} officier{onlineOfficers.length > 1 ? "s" : ""} en service
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={loadData} className="p-2">
            <RefreshCw size={18}/>
          </Button>
          <Button variant="danger" onClick={endService} className="flex items-center gap-2">
            <StopCircle size={16}/> Fin de service
          </Button>
        </div>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <div>
              <p className="text-emerald-400 font-medium text-sm">
                En service depuis {formatDuration(serviceStatus.service ? serviceStatus.service.current_duration : 0)}
              </p>
              {serviceStatus.patrol && (
                <p className="text-xs text-slate-400">
                  Patrouille: {serviceStatus.patrol.name}
                  {serviceStatus.patrol.call_sign && " (" + serviceStatus.patrol.call_sign + ")"}
                </p>
              )}
            </div>
          </div>
          {currentOperator && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-900/20 border border-purple-800 rounded text-xs">
              <Headphones size={14} className="text-purple-400"/>
              <span className="text-purple-300">
                Operateur: <span className="font-medium text-white">{currentOperator.first_name} {currentOperator.last_name}</span>
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Users size={18} className="text-blue-600"/>
              En Service ({onlineOfficers.length})
            </h2>
          </div>

          <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
            {onlineOfficers.map(function(officer) {
              return (
                <Card 
                  key={officer.id} 
                  className={officer.is_operator ? "border-purple-500" : officer.patrol_id ? "border-blue-500/50" : ""}
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-9 h-9 rounded bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden border-2 text-xs font-medium"
                      style={{borderColor: officer.grade_color}}
                    >
                      {officer.profile_picture ? (
                        <img src={officer.profile_picture} className="w-full h-full object-cover"/>
                      ) : (officer.first_name ? officer.first_name[0] : "?")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-800 dark:text-white text-sm truncate">
                          {officer.first_name} {officer.last_name}
                        </p>
                        {officer.is_operator && <Headphones size={12} className="text-purple-400 flex-shrink-0"/>}
                      </div>
                      <p className="text-xs truncate" style={{color: officer.grade_color}}>{officer.grade_name}</p>
                      {officer.patrol_name && (
                        <p className="text-xs text-blue-500 truncate">{officer.patrol_call_sign || officer.patrol_name}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-mono text-slate-500">{formatDuration(officer.duration)}</p>
                      {!officer.patrol_id && <Badge variant="warning">Dispo</Badge>}
                    </div>
                  </div>
                  
                  {canManage && !officer.patrol_id && (
                    <div className="flex gap-1 mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={function() { assignOperator(officer.id) }}
                        className="flex-1 text-purple-500"
                      >
                        <Headphones size={12} className="mr-1"/> Centrale
                      </Button>
                    </div>
                  )}
                  
                  {hasPerm("force_end_service") && user && officer.id !== user.id && (
                    <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={function() { forceEndService(officer.id, officer.first_name + " " + officer.last_name) }}
                        className="w-full text-red-500"
                      >
                        <StopCircle size={12} className="mr-1"/> Forcer fin service
                      </Button>
                    </div>
                  )}
                </Card>
              )
            })}
            {onlineOfficers.length === 0 && (
              <div className="text-center py-8 text-slate-400 bg-slate-800/50 rounded border border-dashed border-slate-700">
                Aucun officier en service
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Car size={18} className="text-emerald-600"/>
              Patrouilles
            </h2>
            {canManage && (
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={function() { setShowDispatchModal(true) }}>
                  <Siren size={14} className="mr-1"/> Appel
                </Button>
                <Button variant="secondary" size="sm" onClick={function() { setShowNoteModal(true) }}>
                  <MessageSquare size={14} className="mr-1"/> Note
                </Button>
                <Button size="sm" onClick={openCreatePatrol}>
                  <Plus size={14} className="mr-1"/> Patrouille
                </Button>
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            {patrols.map(function(patrol) {
              var statusInfo = PATROL_STATUSES.find(function(s) { return s.id === patrol.status }) || PATROL_STATUSES[0]
              var StatusIcon = statusInfo.icon
              
              return (
                <Card 
                  key={patrol.id} 
                  noPadding
                  className={
                    patrol.status === "emergency" ? "border-red-500" :
                    patrol.status === "busy" ? "border-amber-500" : ""
                  }
                >
                  <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={"w-9 h-9 rounded flex items-center justify-center bg-" + statusInfo.color + "-50 dark:bg-" + statusInfo.color + "-900/20"}>
                          <StatusIcon size={18} className={"text-" + statusInfo.color + "-600"}/>
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-800 dark:text-white text-sm">{patrol.name}</h3>
                          {patrol.call_sign && (
                            <p className="text-xs font-mono text-blue-600">{patrol.call_sign}</p>
                          )}
                        </div>
                      </div>
                      {canManage && (
                        <div className="flex gap-1">
                          <button onClick={function() { openEditPatrol(patrol) }} className="p-1.5 text-slate-400 hover:text-blue-500">
                            <Pencil size={14}/>
                          </button>
                          <button onClick={function() { deletePatrol(patrol.id) }} className="p-1.5 text-slate-400 hover:text-red-500">
                            <Trash2 size={14}/>
                          </button>
                        </div>
                      )}
                    </div>

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

                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-slate-500 uppercase">
                        Equipage ({patrol.member_count || 0})
                      </span>
                      {canManage && (
                        <button 
                          onClick={function() { openAssignModal(patrol) }}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          + Ajouter
                        </button>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      {patrol.members && patrol.members.map(function(m) {
                        return (
                          <div key={m.id} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-700/50 rounded">
                            <div className="w-6 h-6 rounded bg-slate-200 dark:bg-slate-600 flex items-center justify-center overflow-hidden text-xs font-medium">
                              {m.profile_picture ? (
                                <img src={m.profile_picture} className="w-full h-full object-cover"/>
                              ) : (m.first_name ? m.first_name[0] : "?")}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-slate-800 dark:text-white truncate flex items-center gap-1">
                                {m.first_name} {m.last_name}
                                {m.role === "leader" && <Crown size={10} className="text-amber-500"/>}
                              </p>
                            </div>
                            {canManage && (
                              <div className="flex gap-1">
                                {m.role !== "leader" && (
                                  <button 
                                    onClick={function() { setLeader(patrol.id, m.id) }}
                                    className="p-1 text-slate-400 hover:text-amber-500"
                                  >
                                    <Crown size={12}/>
                                  </button>
                                )}
                                <button 
                                  onClick={function() { unassignOfficer(patrol.id, m.id) }}
                                  className="p-1 text-slate-400 hover:text-red-500"
                                >
                                  <X size={12}/>
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                      {(!patrol.members || patrol.members.length === 0) && (
                        <p className="text-xs text-slate-400 text-center py-2">Aucun membre</p>
                      )}
                    </div>
                  </div>

                  {canManage && (
                    <div className="px-4 pb-4">
                      <div className="flex gap-1">
                        {PATROL_STATUSES.filter(function(s) { return s.id !== "offline" }).map(function(s) {
                          return (
                            <button
                              key={s.id}
                              onClick={function() { updatePatrolStatus(patrol.id, s.id) }}
                              className={"flex-1 px-2 py-1.5 text-xs font-medium rounded transition-colors " + (
                                patrol.status === s.id 
                                  ? "bg-" + s.color + "-600 text-white" 
                                  : "bg-" + s.color + "-50 dark:bg-" + s.color + "-900/20 text-" + s.color + "-600 hover:bg-" + s.color + "-100"
                              )}
                            >
                              {s.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </Card>
              )
            })}
            {patrols.length === 0 && (
              <div className="md:col-span-2 text-center py-12 text-slate-400 bg-slate-800/50 rounded border border-dashed border-slate-700">
                Aucune patrouille active
                {canManage && (
                  <Button onClick={openCreatePatrol} className="block mx-auto mt-4">
                    Creer une patrouille
                  </Button>
                )}
              </div>
            )}
          </div>

          {dispatches.filter(function(d) { return d.status !== "completed" && d.status !== "cancelled" }).length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Siren size={16} className="text-red-500"/>
                Appels en cours
              </h3>
              <div className="space-y-2">
                {dispatches.filter(function(d) { return d.status !== "completed" && d.status !== "cancelled" }).map(function(d) {
                  return (
                    <Card 
                      key={d.id} 
                      className={
                        d.priority >= 2 ? "border-red-500 bg-red-900/10" :
                        d.priority === 1 ? "border-amber-500 bg-amber-900/10" : ""
                      }
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-white text-sm">{d.call_type}</p>
                          <p className="text-xs text-slate-400">{d.location || "Localisation inconnue"}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {d.patrol_name && (
                            <Badge variant="info">{d.patrol_call_sign || d.patrol_name}</Badge>
                          )}
                          <Badge variant={
                            d.status === "pending" ? "warning" :
                            d.status === "dispatched" ? "info" : "success"
                          }>
                            {d.status === "pending" ? "En attente" :
                             d.status === "dispatched" ? "Assigne" :
                             d.status === "en_route" ? "En route" : "Sur place"}
                          </Badge>
                        </div>
                      </div>
                      {canManage && (
                        <div className="flex gap-2 mt-3">
                          {d.status !== "on_scene" && (
                            <Button 
                              size="sm"
                              onClick={function() { 
                                updateDispatchStatus(d.id, 
                                  d.status === "pending" ? "dispatched" : 
                                  d.status === "dispatched" ? "en_route" : "on_scene"
                                ) 
                              }}
                            >
                              {d.status === "pending" ? "Assigner" : 
                               d.status === "dispatched" ? "En route" : "Sur place"}
                            </Button>
                          )}
                          <Button variant="success" size="sm" onClick={function() { updateDispatchStatus(d.id, "completed") }}>
                            Termine
                          </Button>
                          <Button variant="secondary" size="sm" onClick={function() { updateDispatchStatus(d.id, "cancelled") }}>
                            Annuler
                          </Button>
                        </div>
                      )}
                    </Card>
                  )
                })}
              </div>
            </div>
          )}

          <Card noPadding className="overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <MessageSquare size={16} className="text-blue-500"/>
                Journal de bord
              </h3>
            </div>
            <div className="max-h-60 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-700">
              {notes.map(function(note) {
                return (
                  <div 
                    key={note.id} 
                    className={"px-4 py-3 " + (
                      note.is_pinned ? "bg-amber-50 dark:bg-amber-900/10" :
                      note.note_type === "urgent" ? "bg-red-50 dark:bg-red-900/10" : ""
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <div className={"w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 " + (
                        note.note_type === "urgent" ? "bg-red-100 text-red-600" :
                        note.note_type === "warning" ? "bg-amber-100 text-amber-600" :
                        "bg-blue-100 text-blue-600"
                      )}>
                        {note.note_type === "urgent" ? <AlertCircle size={12}/> : <MessageSquare size={12}/>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-800 dark:text-white">{note.content}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                          <span>{note.author_first_name} {note.author_last_name}</span>
                          <span>-</span>
                          <span>{new Date(note.created_at).toLocaleTimeString("fr-FR", {hour: "2-digit", minute: "2-digit"})}</span>
                        </div>
                      </div>
                      {canManage && (
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={function() { togglePinNote(note.id) }} className={"p-1 " + (note.is_pinned ? "text-amber-500" : "text-slate-400") + " hover:text-amber-500"}>
                            <Pin size={12}/>
                          </button>
                          <button onClick={function() { deleteNote(note.id) }} className="p-1 text-slate-400 hover:text-red-500">
                            <Trash2 size={12}/>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              {notes.length === 0 && (
                <div className="px-4 py-8 text-center text-slate-400">Aucune note</div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {showPatrolModal && (
        <Modal title={editingPatrol ? "Modifier Patrouille" : "Nouvelle Patrouille"} onClose={function() { setShowPatrolModal(false) }}>
          <form onSubmit={savePatrol} className="space-y-4">
            <InputField label="Nom" value={patrolForm.name} onChange={function(e) { setPatrolForm({...patrolForm, name: e.target.value}) }} required />
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Indicatif" placeholder="ADAM-12" value={patrolForm.call_sign} onChange={function(e) { setPatrolForm({...patrolForm, call_sign: e.target.value}) }} />
              <InputField label="Vehicule" value={patrolForm.vehicle} onChange={function(e) { setPatrolForm({...patrolForm, vehicle: e.target.value}) }} />
            </div>
            <InputField label="Secteur" value={patrolForm.sector} onChange={function(e) { setPatrolForm({...patrolForm, sector: e.target.value}) }} />
            <TextArea label="Notes" value={patrolForm.notes} onChange={function(e) { setPatrolForm({...patrolForm, notes: e.target.value}) }} />
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={function() { setShowPatrolModal(false) }} className="flex-1">Annuler</Button>
              <Button type="submit" className="flex-1">{editingPatrol ? "Enregistrer" : "Creer"}</Button>
            </div>
          </form>
        </Modal>
      )}

      {showAssignModal && selectedPatrol && (
        <Modal title={"Assigner a " + selectedPatrol.name} onClose={function() { setShowAssignModal(false) }}>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {availableOfficers.length > 0 ? (
              availableOfficers.map(function(officer) {
                return (
                  <button
                    key={officer.id}
                    onClick={function() { assignOfficer(officer.id); setShowAssignModal(false) }}
                    className="w-full flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded bg-slate-200 dark:bg-slate-600 flex items-center justify-center overflow-hidden text-sm font-medium">
                      {officer.profile_picture ? (
                        <img src={officer.profile_picture} className="w-full h-full object-cover"/>
                      ) : (officer.first_name ? officer.first_name[0] : "?")}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-800 dark:text-white text-sm">{officer.first_name} {officer.last_name}</p>
                      <p className="text-xs" style={{color: officer.grade_color}}>{officer.grade_name}</p>
                    </div>
                    <Plus className="text-blue-500" size={16}/>
                  </button>
                )
              })
            ) : (
              <div className="text-center py-8 text-slate-400">Aucun officier disponible</div>
            )}
          </div>
        </Modal>
      )}

      {showNoteModal && (
        <Modal title="Nouvelle Note" onClose={function() { setShowNoteModal(false) }}>
          <form onSubmit={saveNote} className="space-y-4">
            <TextArea label="Message" value={noteForm.content} onChange={function(e) { setNoteForm({...noteForm, content: e.target.value}) }} required />
            <SelectField label="Type" value={noteForm.note_type} onChange={function(e) { setNoteForm({...noteForm, note_type: e.target.value}) }}>
              <option value="info">Information</option>
              <option value="warning">Attention</option>
              <option value="urgent">Urgent</option>
            </SelectField>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={noteForm.is_pinned} onChange={function(e) { setNoteForm({...noteForm, is_pinned: e.target.checked}) }} className="rounded"/>
              <span className="text-sm text-slate-600 dark:text-slate-300">Epingler cette note</span>
            </label>
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={function() { setShowNoteModal(false) }} className="flex-1">Annuler</Button>
              <Button type="submit" className="flex-1">Publier</Button>
            </div>
          </form>
        </Modal>
      )}

      {showDispatchModal && (
        <Modal title="Nouvel Appel" onClose={function() { setShowDispatchModal(false) }}>
          <form onSubmit={saveDispatch} className="space-y-4">
            <SelectField label="Type" value={dispatchForm.call_type} onChange={function(e) {
              var callType = CALL_TYPES.find(function(c) { return c.label === e.target.value })
              setDispatchForm({...dispatchForm, call_type: e.target.value, priority: callType ? callType.priority : 0})
            }} required>
              <option value="">Selectionner...</option>
              {CALL_TYPES.map(function(c) { return <option key={c.id} value={c.label}>{c.label}</option> })}
            </SelectField>
            <InputField label="Localisation" value={dispatchForm.location} onChange={function(e) { setDispatchForm({...dispatchForm, location: e.target.value}) }} />
            <TextArea label="Description" value={dispatchForm.description} onChange={function(e) { setDispatchForm({...dispatchForm, description: e.target.value}) }} />
            <SelectField label="Assigner a" value={dispatchForm.patrol_id} onChange={function(e) { setDispatchForm({...dispatchForm, patrol_id: e.target.value}) }}>
              <option value="">-- Non assigne --</option>
              {patrols.filter(function(p) { return p.status === "available" }).map(function(p) {
                return <option key={p.id} value={p.id}>{p.call_sign || p.name}</option>
              })}
            </SelectField>
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={function() { setShowDispatchModal(false) }} className="flex-1">Annuler</Button>
              <Button type="submit" className="flex-1">Creer</Button>
            </div>
          </form>
        </Modal>
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
  
  const load = function() {
    setLoading(true)
    apiFetch("/api/appointments")
      .then(function(r) { return r ? r.json() : [] })
      .then(function(d) { setComplaints(Array.isArray(d) ? d : []) })
      .catch(function() { setComplaints([]) })
      .finally(function() { setLoading(false) })
  }
  
  useEffect(function() { load() }, [])
  
  const handleStatus = async function(id, action) {
    await apiFetch("/api/appointments/" + id + "/" + action, { method: "POST" })
    load()
  }

  const deleteComplaint = async function(id) {
    if (!hasPerm("delete_appointments")) return
    if (window.confirm("Supprimer definitivement ce dossier ?")) {
      await apiFetch("/api/appointments/" + id, { method: "DELETE" })
      load()
    }
  }

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Plaintes et Requetes</h1>
          <p className="text-slate-500 text-sm mt-1">Gestion des dossiers citoyens</p>
        </div>
        <Button variant="ghost" onClick={load}>
          <RefreshCw size={18}/>
        </Button>
      </div>
      
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="space-y-3">
          {complaints.map(function(c) {
            return (
              <Card key={c.id} className="flex flex-col md:flex-row justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant={
                      c.status === "pending" ? "warning" : 
                      c.status === "assigned" ? "info" : 
                      c.status === "cancelled" ? "danger" : "success"
                    }>
                      {c.status === "pending" ? "En Attente" : 
                       c.status === "assigned" ? "En Cours" : 
                       c.status === "cancelled" ? "Refusee" : "Cloturee"}
                    </Badge>
                    <span className="text-slate-400 text-xs font-mono">
                      #{c.id} - {new Date(c.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">
                    {c.appointment_type} - {c.patient_name}
                  </h3>
                  <p className="text-slate-500 text-sm mt-1 line-clamp-2">{c.description}</p>
                  <div className="flex gap-4 text-xs text-slate-400 mt-2 font-mono">
                    <span className="flex items-center gap-1"><Phone size={12}/> {c.patient_phone || "N/A"}</span>
                    {c.medic_first_name && <span>Assigne: {c.medic_first_name} {c.medic_last_name}</span>}
                  </div>
                </div>
                
                <div className="flex md:flex-col gap-2 pt-4 md:pt-0 md:pl-4 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700 justify-center items-center">
                  {hasPerm("manage_appointments") && (
                    <>
                      {c.status === "pending" && (
                        <Button size="sm" onClick={function() { handleStatus(c.id, "assign") }}>
                          Prendre en charge
                        </Button>
                      )}
                      {c.status === "assigned" && (
                        <Button variant="success" size="sm" onClick={function() { handleStatus(c.id, "complete") }}>
                          Cloturer
                        </Button>
                      )}
                      {c.status !== "completed" && c.status !== "cancelled" && (
                        <Button variant="ghost" size="sm" onClick={function() { handleStatus(c.id, "cancel") }} className="text-red-500">
                          Refuser
                        </Button>
                      )}
                    </>
                  )}
                  
                  {hasPerm("delete_appointments") && (
                    <button 
                      onClick={function() { deleteComplaint(c.id) }} 
                      className="p-2 text-slate-400 hover:text-red-500"
                    >
                      <Trash2 size={16}/>
                    </button>
                  )}
                </div>
              </Card>
            )
          })}
          {complaints.length === 0 && (
            <div className="text-center py-12 text-slate-400 bg-slate-800/50 rounded border border-dashed border-slate-700">
              Aucune plainte a traiter
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
  
  useEffect(function() {
    apiFetch("/api/users/roster")
      .then(function(r) { return r ? r.json() : [] })
      .then(function(d) { setMembers(Array.isArray(d) ? d : []) })
      .finally(function() { setLoading(false) })
  }, [])
  
  var order = ["High Command", "Command Staff", "Supervisors", "Officers", "Systeme"];
  var grouped = members.reduce(function(acc, m) {
    var cat = m.grade_category || "Autres";
    if(!acc[cat]) acc[cat] = [];
    acc[cat].push(m);
    return acc;
  }, {});

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Effectifs LSPD</h1>
        <p className="text-slate-500 text-sm mt-1">Liste des officiers et etat-major</p>
      </div>
      
      <div className="space-y-8">
        {order.map(function(cat) {
          if (!grouped[cat]) return null
          return (
            <div key={cat}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-blue-600 mb-3 pb-2 border-b border-slate-200 dark:border-slate-700">
                {cat}
              </h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                {grouped[cat].sort(function(a,b) { return b.grade_level - a.grade_level }).map(function(m) {
                  return (
                    <Card key={m.id} className="flex items-center gap-4 border-l-2" style={{borderLeftColor: m.grade_color}}>
                      <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded flex items-center justify-center font-medium text-slate-500 overflow-hidden text-sm border border-slate-300 dark:border-slate-600">
                        {m.profile_picture ? (
                          <img src={m.profile_picture} className="w-full h-full object-cover"/>
                        ) : (m.first_name ? m.first_name[0] : "?")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 dark:text-white text-sm">{m.grade_name}</p>
                        <p className="text-xs text-slate-500">{m.last_name} {m.first_name}</p>
                        <p className="text-xs font-mono text-slate-400 mt-0.5">Mle: {m.badge_number || "N/A"}</p>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </Layout>
  )
}

// ============================================================================
// ADMIN
// ============================================================================
function Admin() {
  const { user, hasPerm } = useAuth()
  const [activeTab, setActiveTab] = useState("users")
  const [users, setUsers] = useState([])
  const [grades, setGrades] = useState([])
  const [logs, setLogs] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editingId, setEditingId] = useState(null)
  
  const [gradeModal, setGradeModal] = useState(false)
  const [editingGrade, setEditingGrade] = useState(null)
  const [gradeForm, setGradeForm] = useState({ name: "", color: "", permissions: {} })

  const [form, setForm] = useState({ 
    username: "", password: "", first_name: "", last_name: "", 
    badge_number: "", grade_id: "", visible_grade_id: "" 
  })

  var load = useCallback(function() {
    if(activeTab === "users" && hasPerm("manage_users")) {
      apiFetch("/api/admin/users").then(function(r) { return r && r.ok ? r.json() : [] }).then(setUsers);
    }
    if(activeTab === "grades") {
      apiFetch("/api/admin/grades").then(function(r) { return r && r.ok ? r.json() : [] }).then(setGrades);
    }
    if(activeTab === "logs" && hasPerm("view_logs")) {
      apiFetch("/api/admin/logs?limit=100").then(function(r) { return r && r.ok ? r.json() : [] }).then(setLogs);
    }
    apiFetch("/api/admin/grades").then(function(r) { return r && r.ok ? r.json() : [] }).then(setGrades);
  }, [activeTab, hasPerm]);

  useEffect(function() { load() }, [load])

  var openCreateModal = function() {
    setForm({ username: "", password: "", first_name: "", last_name: "", badge_number: "", grade_id: "", visible_grade_id: "" });
    setIsEditing(false);
    setEditingId(null);
    setShowModal(true);
  }

  var openEditModal = function(u) {
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

  var submitUser = async function(e) {
    e.preventDefault()
    var method = isEditing ? "PUT" : "POST";
    var url = isEditing ? "/api/admin/users/" + editingId : "/api/admin/users";
    var res = await apiFetch(url, { method: method, body: JSON.stringify(form) })
    
    if (res && res.ok) {
      setShowModal(false)
      load()
    } else {
      var err = res ? await res.json() : {}
      alert(err.error || "Erreur")
    }
  }
  
  var deleteUser = async function(id) {
    if (!hasPerm("delete_users")) return
    if(window.confirm("Renvoyer definitivement cet officier ?")) {
      await apiFetch("/api/admin/users/" + id, { method: "DELETE" })
      load()
    }
  }

  var editGrade = function(g) {
    if (!hasPerm("manage_grades")) return
    setEditingGrade(g);
    setGradeForm({ name: g.name, color: g.color, permissions: g.permissions || {} });
    setGradeModal(true);
  }

  var saveGrade = async function(e) {
    e.preventDefault();
    var res = await apiFetch("/api/admin/grades/" + editingGrade.id, { method: "PUT", body: JSON.stringify(gradeForm) });
    if (res && res.ok) {
      setGradeModal(false);
      load();
    }
  }

  var togglePerm = function(permKey) {
    var newPerms = {...gradeForm.permissions}
    newPerms[permKey] = !newPerms[permKey]
    setGradeForm({...gradeForm, permissions: newPerms});
  }

  var allTabs = [
    { id: "users", label: "Utilisateurs", icon: Users, perm: "manage_users" },
    { id: "grades", label: "Grades", icon: Settings, perm: "manage_grades" },
    { id: "logs", label: "Logs", icon: ScrollText, perm: "view_logs" },
  ]
  var tabs = allTabs.filter(function(t) { return hasPerm(t.perm) })

  useEffect(function() {
    if (tabs.length > 0 && !tabs.find(function(t) { return t.id === activeTab })) {
      setActiveTab(tabs[0].id)
    }
  }, [tabs, activeTab])

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Administration</h1>
      </div>

      <div className="flex gap-1 mb-6 border-b border-slate-200 dark:border-slate-700">
        {tabs.map(function(t) {
          return (
            <button 
              key={t.id} 
              onClick={function() { setActiveTab(t.id) }} 
              className={"flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px " + (
                activeTab === t.id 
                  ? "border-blue-600 text-blue-600" 
                  : "border-transparent text-slate-500 hover:text-slate-700"
              )}
            >
              <t.icon size={16}/> {t.label}
            </button>
          )
        })}
      </div>

      <Card noPadding className="overflow-hidden">
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
                  {users.map(function(u) {
                    return (
                      <tr key={u.id} className={"hover:bg-slate-50 dark:hover:bg-slate-800/50 " + (!u.is_active ? "opacity-50" : "")}>
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
                            <button onClick={function() { openEditModal(u) }} className="p-2 text-slate-400 hover:text-blue-500 rounded">
                              <Pencil size={16} />
                            </button>
                            {user && u.id !== user.id && hasPerm("delete_users") && (
                              <button onClick={function() { deleteUser(u.id) }} className="p-2 text-slate-400 hover:text-red-500 rounded">
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
        
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
                {grades.map(function(g) {
                  return (
                    <tr key={g.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-5 py-3 font-medium flex items-center gap-3">
                        <div className="w-3 h-3 rounded" style={{background: g.color}}></div>
                        <span className="text-slate-800 dark:text-white">{g.name}</span>
                      </td>
                      <td className="px-5 py-3 font-mono text-slate-500">{g.level}</td>
                      <td className="px-5 py-3 text-slate-500 text-xs">
                        {Object.keys(g.permissions || {}).filter(function(k) { return g.permissions[k] }).length} / {PERMISSIONS_LIST.length}
                      </td>
                      {hasPerm("manage_grades") && (
                        <td className="px-5 py-3 text-right">
                          <Button variant="secondary" size="sm" onClick={function() { editGrade(g) }}>
                            Configurer
                          </Button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "logs" && hasPerm("view_logs") && (
          <div className="max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase font-medium text-slate-500 sticky top-0">
                <tr>
                  <th className="px-5 py-3 text-left">Date</th>
                  <th className="px-5 py-3 text-left">Utilisateur</th>
                  <th className="px-5 py-3 text-left">Action</th>
                  <th className="px-5 py-3 text-left">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {logs.map(function(l, i) {
                  return (
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
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showModal && (
        <Modal 
          title={isEditing ? "Modifier Officier" : "Nouvel Officier"} 
          onClose={function() { setShowModal(false) }}
          size="lg"
        >
          <form onSubmit={submitUser} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Prenom" value={form.first_name} onChange={function(e) { setForm({...form, first_name: e.target.value}) }} required />
              <InputField label="Nom" value={form.last_name} onChange={function(e) { setForm({...form, last_name: e.target.value}) }} required />
            </div>
            <InputField label="Identifiant" value={form.username} onChange={function(e) { setForm({...form, username: e.target.value}) }} required disabled={isEditing} />
            <InputField 
              label={isEditing ? "Nouveau mot de passe" : "Mot de passe"} 
              type="password" 
              placeholder={isEditing ? "Laisser vide si inchange" : ""}
              value={form.password} 
              onChange={function(e) { setForm({...form, password: e.target.value}) }} 
              required={!isEditing} 
            />
            <InputField label="Matricule" value={form.badge_number} onChange={function(e) { setForm({...form, badge_number: e.target.value}) }} />
            <SelectField label="Grade" value={form.grade_id} onChange={function(e) { setForm({...form, grade_id: e.target.value}) }} required>
              <option value="">Selectionner un grade</option>
              {grades.map(function(g) { return <option key={g.id} value={g.id}>{g.name} (Niveau {g.level})</option> })}
            </SelectField>
            <SelectField label="Grade Visible (optionnel)" value={form.visible_grade_id} onChange={function(e) { setForm({...form, visible_grade_id: e.target.value}) }}>
              <option value="">-- Utiliser le vrai grade --</option>
              {grades.map(function(g) { return <option key={g.id} value={g.id}>{g.name}</option> })}
            </SelectField>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="secondary" onClick={function() { setShowModal(false) }} className="flex-1">
                Annuler
              </Button>
              <Button type="submit" className="flex-1">
                {isEditing ? "Enregistrer" : "Creer"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {gradeModal && editingGrade && (
        <Modal 
          title={"Configuration: " + editingGrade.name} 
          onClose={function() { setGradeModal(false) }}
          size="lg"
        >
          <form onSubmit={saveGrade} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Nom du Grade" value={gradeForm.name} onChange={function(e) { setGradeForm({...gradeForm, name: e.target.value}) }} />
              <div className="mb-4">
                <label className="block text-xs font-semibold uppercase tracking-wide mb-2 text-slate-600 dark:text-slate-400">Couleur</label>
                <input 
                  type="color" 
                  className="w-full h-10 rounded cursor-pointer border border-slate-300 dark:border-slate-600" 
                  value={gradeForm.color} 
                  onChange={function(e) { setGradeForm({...gradeForm, color: e.target.value}) }} 
                />
              </div>
            </div>
            
            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Permissions</p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {PERMISSIONS_LIST.map(function(p) {
                  return (
                    <label 
                      key={p.key} 
                      className="flex items-start gap-3 p-3 rounded hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-600 transition-colors"
                    >
                      <input 
                        type="checkbox" 
                        checked={gradeForm.permissions[p.key] || false} 
                        onChange={function() { togglePerm(p.key) }}
                        className="w-4 h-4 mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{p.label}</span>
                        <p className="text-xs text-slate-500">{p.description}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="secondary" onClick={function() { setGradeModal(false) }} className="flex-1">
                Annuler
              </Button>
              <Button type="submit" className="flex-1">Sauvegarder</Button>
            </div>
          </form>
        </Modal>
      )}
    </Layout>
  )
}

// ============================================================================
// PUBLIC PAGES
// ============================================================================
function PublicComplaint() {
  const [form, setForm] = useState({ 
    patient_name: "", patient_phone: "", patient_discord: "", 
    appointment_type: "Vol", description: "" 
  })
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  
  var submit = async function(e) {
    e.preventDefault()
    setLoading(true)
    try {
      var res = await fetch("/api/appointments/public", { 
        method: "POST", 
        headers: {"Content-Type":"application/json"}, 
        body: JSON.stringify(form) 
      })
      if (res.ok) setDone(true)
      else {
        var err = await res.json()
        alert(err.error || "Erreur lors de l envoi")
      }
    } catch (ex) {
      alert("Erreur de connexion")
    }
    setLoading(false)
  }
  
  if(done) return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 bg-emerald-600 rounded flex items-center justify-center text-white mb-6">
        <CheckCircle size={32}/>
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">Plainte Enregistree</h1>
      <p className="text-slate-400 mb-8 max-w-md text-sm">
        Votre declaration a ete transmise aux services du LSPD.
      </p>
      <Button onClick={function() { navigate("/") }}>Retour accueil</Button>
    </div>
  )
  
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white dark:bg-slate-800 p-6 rounded border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-4 mb-6 pb-4 border-b border-slate-200 dark:border-slate-700">
          <div className="w-10 h-10 bg-blue-600 rounded flex items-center justify-center">
            <Shield size={20} className="text-white"/>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">Deposer une Plainte</h1>
            <p className="text-slate-500 text-xs">Formulaire officiel LSPD</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <InputField label="Identite (Nom Prenom)" placeholder="John Doe" value={form.patient_name} onChange={function(e) { setForm({...form, patient_name: e.target.value}) }} required />
          <div className="grid grid-cols-2 gap-4">
            <InputField label="Telephone" placeholder="555-0100" value={form.patient_phone} onChange={function(e) { setForm({...form, patient_phone: e.target.value}) }} />
            <InputField label="Discord" placeholder="pseudo#0000" value={form.patient_discord} onChange={function(e) { setForm({...form, patient_discord: e.target.value}) }} />
          </div>
          <SelectField label="Motif de la plainte" value={form.appointment_type} onChange={function(e) { setForm({...form, appointment_type: e.target.value}) }}>
            <option value="Vol">Vol / Cambriolage</option>
            <option value="Agression">Agression / Coups et blessures</option>
            <option value="Menace">Menaces / Harcelement</option>
            <option value="Degradation">Degradation de biens</option>
            <option value="Autre">Autre motif</option>
          </SelectField>
          <TextArea label="Description des faits" placeholder="Decrivez ce qui s est passe..." value={form.description} onChange={function(e) { setForm({...form, description: e.target.value}) }} required />
          <div className="pt-4 flex gap-3">
            <Button type="button" variant="secondary" onClick={function() { navigate("/") }} className="flex-1">
              Annuler
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : "Envoyer"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Login() {
  const { login, user, authChecked } = useAuth()
  const [form, setForm] = useState({ username: "", password: "" })
  const [err, setErr] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()
  
  useEffect(function() {
    if (authChecked && user) {
      navigate("/dashboard")
    }
  }, [authChecked, user, navigate])
  
  var submit = async function(e) {
    e.preventDefault()
    setErr("")
    setLoading(true)
    var res = await login(form.username, form.password)
    setLoading(false)
    if(res.success) {
      navigate("/dashboard")
    } else {
      setErr(res.error || "Erreur d identification")
    }
  }
  
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-slate-800 p-6 rounded border border-slate-700">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-blue-600 rounded flex items-center justify-center mx-auto mb-4">
            <Shield size={28} className="text-white"/>
          </div>
          <h1 className="text-xl font-bold text-white">LSPD Intranet</h1>
          <p className="text-slate-500 text-xs mt-1">Acces reserve aux officiers</p>
        </div>
        
        {err && (
          <div className="bg-red-900/30 text-red-400 px-3 py-2 rounded mb-4 text-sm text-center border border-red-800">
            {err}
          </div>
        )}
        
        <form onSubmit={submit} className="space-y-4">
          <InputField 
            label="Identifiant" 
            value={form.username} 
            onChange={function(e) { setForm({...form, username: e.target.value}) }}
            autoComplete="username"
          />
          <div className="relative">
            <InputField 
              label="Mot de passe" 
              type={showPassword ? "text" : "password"} 
              value={form.password} 
              onChange={function(e) { setForm({...form, password: e.target.value}) }} 
            />
            <button 
              type="button"
              onClick={function() { setShowPassword(!showPassword) }}
              className="absolute right-3 top-8 text-slate-400 hover:text-white"
            >
              {showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
            </button>
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
            ) : "Connexion"}
          </Button>
        </form>
        
        <div className="mt-6 text-center">
          <Link to="/plainte" className="text-slate-500 hover:text-white text-xs font-medium transition-colors">
            Deposer une plainte (Civil)
          </Link>
        </div>
      </div>
    </div>
  )
}

function Landing() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center relative">
      <div className="text-center space-y-6 p-6">
        <div className="w-20 h-20 bg-blue-600 rounded flex items-center justify-center mx-auto">
          <Shield size={40} className="text-white"/>
        </div>
        <div>
          <h1 className="text-4xl font-bold text-white tracking-tight">L.S.P.D</h1>
          <p className="text-blue-500 text-sm font-medium uppercase tracking-widest mt-1">
            Los Santos Police Department
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 pt-6">
          <Link to="/login">
            <Button size="lg" className="w-full sm:w-auto flex items-center gap-2">
              <Lock size={18}/> Acces Officier
            </Button>
          </Link>
          <Link to="/plainte">
            <Button variant="secondary" size="lg" className="w-full sm:w-auto flex items-center gap-2">
              <FileText size={18}/> Porter Plainte
            </Button>
          </Link>
        </div>
      </div>
      <div className="absolute bottom-4 text-slate-600 text-xs font-mono">
        SECURE CONNECTION - AUTHORIZED PERSONNEL ONLY
      </div>
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { user, loading, authChecked } = useAuth()
  
  if (!authChecked || loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }
  
  if (!user) return <Navigate to="/login" />
  return children
}

// ============================================================================
// APP
// ============================================================================
export default function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  )
}


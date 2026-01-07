import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Shield, Users, ClipboardList, LogOut, LayoutDashboard, Menu, X, 
  Radio, Settings, User, Camera
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch } from '../../utils/api';
import { formatDuration } from '../../utils/constants';
import { Button, Modal, InputField } from '../ui';
import SidebarItem from './SidebarItem';

export function Layout({ children }) {
  const { user, logout, hasPerm, refreshUser } = useAuth();
  const location = useLocation();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [serviceStatus, setServiceStatus] = useState(null);
  
  const [profileForm, setProfileForm] = useState({ 
    first_name: "", last_name: "", phone: "", password: "", profile_picture: null 
  });
  const fileInputRef = useRef(null);

  useEffect(() => {
    const checkService = async () => {
      try {
        const res = await apiFetch("/api/centrale/service/status");
        if (res && res.ok) {
          const data = await res.json();
          setServiceStatus(data);
        }
      } catch (e) {}
    };
    checkService();
    const interval = setInterval(checkService, 30000);
    return () => clearInterval(interval);
  }, []);

  const openProfile = () => {
    setProfileForm({
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      phone: user.phone || "",
      password: "",
      profile_picture: null
    });
    setShowProfile(true);
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("first_name", profileForm.first_name);
    formData.append("last_name", profileForm.last_name);
    formData.append("phone", profileForm.phone);
    if (profileForm.password) formData.append("password", profileForm.password);
    if (profileForm.profile_picture instanceof File) {
      formData.append("profile_picture", profileForm.profile_picture);
    }
    
    const res = await apiFetch("/api/users/me", { method: "PUT", body: formData });
    if (res && res.ok) {
      await refreshUser();
      setShowProfile(false);
    } else {
      const err = res ? await res.json() : {};
      alert(err.error || "Erreur lors de la mise à jour");
    }
  };

  const navs = [
    { icon: LayoutDashboard, label: "Dashboard", to: "/dashboard", perm: "access_dashboard" },
    { icon: Radio, label: "Centrale", to: "/centrale", perm: "access_dashboard" },
    { icon: ClipboardList, label: "Plaintes", to: "/plaintes", perm: "access_dashboard" },
    { icon: Users, label: "Effectifs", to: "/roster", perm: "view_roster" },
  ];
  
  if (hasPerm("manage_users") || hasPerm("view_logs") || hasPerm("manage_grades") || hasPerm("delete_users")) {
    navs.push({ icon: Settings, label: "Administration", to: "/admin" });
  }

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
      {/* Sidebar Desktop */}
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

        {/* Service Status */}
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

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {navs.filter(n => !n.perm || hasPerm(n.perm)).map(n => (
            <SidebarItem key={n.to} icon={n.icon} label={n.label} to={n.to} active={location.pathname === n.to} />
          ))}
        </nav>
        
        {/* User Section */}
        <div className="p-3 bg-slate-950 border-t border-slate-800">
          <button 
            onClick={openProfile} 
            className="flex items-center gap-3 w-full text-left hover:bg-slate-900 p-2 rounded transition-colors group"
          >
            <div className="w-9 h-9 rounded bg-slate-800 flex items-center justify-center font-medium text-white border border-slate-700 overflow-hidden text-sm">
              {user && user.profile_picture ? (
                <img src={user.profile_picture} className="w-full h-full object-cover" alt="" />
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
            <LogOut size={14} /> Déconnexion
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-60 flex flex-col min-h-screen">
        {/* Mobile Header */}
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
            <button onClick={() => setMobileMenu(!mobileMenu)} className="text-white">
              <Menu size={20}/>
            </button>
          </div>
        </header>
        
        {/* Mobile Menu */}
        {mobileMenu && (
          <div className="fixed inset-0 bg-slate-900 z-50 p-4 lg:hidden">
            <div className="flex justify-between items-center mb-6">
              <span className="text-white font-bold">Menu</span>
              <button onClick={() => setMobileMenu(false)} className="text-white">
                <X size={20}/>
              </button>
            </div>
            <nav className="space-y-2">
              {navs.filter(n => !n.perm || hasPerm(n.perm)).map(n => (
                <Link 
                  key={n.to} 
                  to={n.to} 
                  onClick={() => setMobileMenu(false)} 
                  className="flex items-center gap-3 p-3 rounded bg-slate-800 text-white font-medium"
                >
                  <n.icon size={18}/> {n.label}
                </Link>
              ))}
              <button 
                onClick={logout} 
                className="w-full flex items-center gap-3 p-3 rounded bg-red-900/20 text-red-400 font-medium mt-4"
              >
                <LogOut size={18}/> Déconnexion
              </button>
            </nav>
          </div>
        )}
        
        {/* Page Content */}
        <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>

      {/* Profile Modal */}
      {showProfile && (
        <Modal title="Profil Officier" onClose={() => setShowProfile(false)}>
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="flex justify-center mb-6">
              <div 
                className="w-20 h-20 rounded bg-slate-200 dark:bg-slate-700 relative group cursor-pointer overflow-hidden border-2 border-slate-300 dark:border-slate-600 hover:border-blue-500 transition-colors"
                onClick={() => fileInputRef.current.click()}
              >
                {profileForm.profile_picture instanceof File ? (
                  <img src={URL.createObjectURL(profileForm.profile_picture)} className="w-full h-full object-cover" alt="" />
                ) : user && user.profile_picture ? (
                  <img src={user.profile_picture} className="w-full h-full object-cover" alt="" />
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
                onChange={(e) => setProfileForm({...profileForm, profile_picture: e.target.files[0]})} 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <InputField 
                label="Prénom" 
                value={profileForm.first_name} 
                onChange={(e) => setProfileForm({...profileForm, first_name: e.target.value})} 
              />
              <InputField 
                label="Nom" 
                value={profileForm.last_name} 
                onChange={(e) => setProfileForm({...profileForm, last_name: e.target.value})} 
              />
            </div>
            <InputField 
              label="Téléphone" 
              value={profileForm.phone} 
              onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})} 
            />
            
            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
              <InputField 
                label="Nouveau mot de passe" 
                type="password" 
                placeholder="Laisser vide si inchangé" 
                value={profileForm.password} 
                onChange={(e) => setProfileForm({...profileForm, password: e.target.value})} 
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                type="button" 
                variant="secondary" 
                onClick={() => setShowProfile(false)} 
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
  );
}

export default Layout;

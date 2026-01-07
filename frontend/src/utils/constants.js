// ============================================================================
// CONSTANTES LSPD MDT - Frontend
// ============================================================================

// ============================================================================
// PERMISSIONS
// ============================================================================
export const PERMISSIONS_LIST = [
  { key: "access_dashboard", label: "Accès Dashboard", description: "Voir le tableau de bord" },
  { key: "view_roster", label: "Voir Effectifs", description: "Consulter la liste des officiers" },
  { key: "manage_appointments", label: "Gérer Plaintes", description: "Assigner, clôturer, refuser les plaintes" },
  { key: "delete_appointments", label: "Supprimer Plaintes", description: "Supprimer définitivement les plaintes" },
  { key: "manage_users", label: "Gérer Utilisateurs", description: "Créer et modifier les officiers" },
  { key: "delete_users", label: "Exclure Officiers", description: "Supprimer définitivement les officiers" },
  { key: "manage_grades", label: "Gérer Grades", description: "Modifier les grades et permissions" },
  { key: "view_logs", label: "Voir les Logs", description: "Accéder aux journaux d'audit" },
  { key: "force_end_service", label: "Forcer Fin Service", description: "Forcer la mise hors service d'un officier" }
];

// ============================================================================
// STATUTS DE PATROUILLE
// ============================================================================
export const PATROL_STATUSES = [
  { 
    id: "available", 
    label: "Disponible", 
    color: "emerald",
    bgLight: "bg-emerald-50",
    bgDark: "dark:bg-emerald-900/20",
    text: "text-emerald-600",
    border: "border-emerald-500",
    buttonActive: "bg-emerald-600 text-white",
    buttonInactive: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 hover:bg-emerald-100"
  },
  { 
    id: "busy", 
    label: "Occupé", 
    color: "amber",
    bgLight: "bg-amber-50",
    bgDark: "dark:bg-amber-900/20",
    text: "text-amber-600",
    border: "border-amber-500",
    buttonActive: "bg-amber-600 text-white",
    buttonInactive: "bg-amber-50 dark:bg-amber-900/20 text-amber-600 hover:bg-amber-100"
  },
  { 
    id: "emergency", 
    label: "Urgence", 
    color: "red",
    bgLight: "bg-red-50",
    bgDark: "dark:bg-red-900/20",
    text: "text-red-600",
    border: "border-red-500",
    buttonActive: "bg-red-600 text-white",
    buttonInactive: "bg-red-50 dark:bg-red-900/20 text-red-600 hover:bg-red-100"
  },
  { 
    id: "break", 
    label: "Pause", 
    color: "slate",
    bgLight: "bg-slate-50",
    bgDark: "dark:bg-slate-900/20",
    text: "text-slate-600",
    border: "border-slate-500",
    buttonActive: "bg-slate-600 text-white",
    buttonInactive: "bg-slate-50 dark:bg-slate-900/20 text-slate-600 hover:bg-slate-100"
  },
  { 
    id: "offline", 
    label: "Hors service", 
    color: "gray",
    bgLight: "bg-gray-50",
    bgDark: "dark:bg-gray-900/20",
    text: "text-gray-600",
    border: "border-gray-500",
    buttonActive: "bg-gray-600 text-white",
    buttonInactive: "bg-gray-50 dark:bg-gray-900/20 text-gray-600 hover:bg-gray-100"
  }
];

export const getPatrolStatus = (statusId) => {
  return PATROL_STATUSES.find(s => s.id === statusId) || PATROL_STATUSES[0];
};

// ============================================================================
// TYPES D'APPELS
// ============================================================================
export const CALL_TYPES = [
  { id: "vol", label: "Vol / Cambriolage", priority: 1 },
  { id: "agression", label: "Agression", priority: 2 },
  { id: "accident", label: "Accident de la route", priority: 1 },
  { id: "tapage", label: "Tapage / Nuisances", priority: 0 },
  { id: "suspect", label: "Individu suspect", priority: 1 },
  { id: "poursuite", label: "Course-poursuite", priority: 2 },
  { id: "arme", label: "Arme à feu", priority: 2 },
  { id: "autre", label: "Autre intervention", priority: 0 }
];

// ============================================================================
// TYPES DE PLAINTES
// ============================================================================
export const COMPLAINT_TYPES = [
  { id: "vol", label: "Vol / Cambriolage" },
  { id: "agression", label: "Agression / Coups et blessures" },
  { id: "menace", label: "Menaces / Harcèlement" },
  { id: "degradation", label: "Dégradation de biens" },
  { id: "autre", label: "Autre motif" }
];

// ============================================================================
// UTILITAIRES DE FORMATAGE
// ============================================================================
export const formatDuration = (seconds) => {
  if (!seconds || seconds < 0) return "0m";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

export const formatDurationLong = (seconds) => {
  if (!seconds || seconds < 0) return "0 minutes";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes}min`;
};

export const formatDate = (date) => {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString("fr-FR");
};

export const formatDateTime = (date) => {
  if (!date) return "N/A";
  return new Date(date).toLocaleString("fr-FR");
};

export const formatTime = (date) => {
  if (!date) return "N/A";
  return new Date(date).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit"
  });
};

// ============================================================================
// MAPPING DE COULEURS
// ============================================================================
export const BADGE_VARIANTS = {
  default: "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300",
  success: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
  warning: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  danger: "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400",
  info: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  purple: "bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400"
};

export const BUTTON_VARIANTS = {
  primary: "bg-blue-600 hover:bg-blue-700 text-white",
  secondary: "bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-white",
  danger: "bg-red-600 hover:bg-red-700 text-white",
  success: "bg-emerald-600 hover:bg-emerald-700 text-white",
  ghost: "bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
};

export const STAT_CARD_COLORS = {
  blue: "text-blue-600 bg-blue-50 dark:bg-blue-900/20",
  green: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20",
  yellow: "text-amber-600 bg-amber-50 dark:bg-amber-900/20",
  red: "text-red-600 bg-red-50 dark:bg-red-900/20",
  purple: "text-purple-600 bg-purple-50 dark:bg-purple-900/20"
};

// ============================================================================
// STORAGE KEYS
// ============================================================================
export const STORAGE_KEYS = {
  TOKEN: "lspd_auth_token",
  TOKEN_EXPIRY: "lspd_token_expiry",
  THEME: "lspd_theme"
};

// ============================================================================
// API ENDPOINTS
// ============================================================================
export const API_ENDPOINTS = {
  LOGIN: "/api/auth/login",
  LOGOUT: "/api/auth/logout",
  ME: "/api/auth/me",
  VERIFY: "/api/auth/verify",
  ROSTER: "/api/users/roster",
  MY_STATS: "/api/users/me/stats",
  UPDATE_PROFILE: "/api/users/me",
  ADMIN_STATS: "/api/admin/stats",
  ADMIN_USERS: "/api/admin/users",
  ADMIN_GRADES: "/api/admin/grades",
  ADMIN_LOGS: "/api/admin/logs",
  APPOINTMENTS: "/api/appointments",
  PUBLIC_COMPLAINT: "/api/appointments/public",
  SERVICE_STATUS: "/api/centrale/service/status",
  SERVICE_START: "/api/centrale/service/start",
  SERVICE_END: "/api/centrale/service/end",
  SERVICE_FORCE_END: "/api/centrale/service/force-end",
  ONLINE_OFFICERS: "/api/centrale/service/online",
  OPERATOR_ASSIGN: "/api/centrale/operator/assign",
  OPERATOR_CURRENT: "/api/centrale/operator/current",
  PATROLS: "/api/centrale/patrols",
  NOTES: "/api/centrale/notes",
  DISPATCH: "/api/centrale/dispatch",
  CENTRALE_STATS: "/api/centrale/stats",
  PATROL_TIMES: "/api/centrale/patrol-times"
};

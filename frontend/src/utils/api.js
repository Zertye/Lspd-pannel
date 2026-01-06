// ============================================================================
// API HELPER - LSPD MDT
// Gestion centralisée des appels API avec gestion d'erreurs
// ============================================================================

import { STORAGE_KEYS } from './constants';

const TOKEN_KEY = STORAGE_KEYS.TOKEN;
const TOKEN_EXPIRY_KEY = STORAGE_KEYS.TOKEN_EXPIRY;

/**
 * Vérifie si le token est expiré côté client
 */
export const isTokenExpired = () => {
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  if (!expiry) return true;
  return new Date().getTime() > parseInt(expiry);
};

/**
 * Récupère le token stocké
 */
export const getToken = () => {
  return localStorage.getItem(TOKEN_KEY);
};

/**
 * Stocke le token avec expiration
 * @param {string} token 
 * @param {number} expiresInMs - Durée en millisecondes (défaut: 7 jours)
 */
export const setToken = (token, expiresInMs = 7 * 24 * 60 * 60 * 1000) => {
  localStorage.setItem(TOKEN_KEY, token);
  const expiryTime = new Date().getTime() + expiresInMs;
  localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
};

/**
 * Supprime le token stocké
 */
export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
};

/**
 * Redirige vers la page de login
 */
const redirectToLogin = () => {
  clearToken();
  if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
    window.location.href = "/login";
  }
};

/**
 * Classe d'erreur API personnalisée
 */
export class ApiError extends Error {
  constructor(message, status, code, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

/**
 * Fonction principale pour les appels API
 * @param {string} url - URL de l'endpoint
 * @param {object} options - Options fetch
 * @returns {Promise<Response>} - Réponse fetch
 */
export const apiFetch = async (url, options = {}) => {
  const token = getToken();
  
  // Vérifier l'expiration du token avant l'appel
  if (token && isTokenExpired()) {
    redirectToLogin();
    throw new ApiError("Session expirée", 401, "TOKEN_EXPIRED");
  }
  
  // Construire les headers
  const headers = { ...options.headers };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  
  try {
    const response = await fetch(url, { ...options, headers });
    
    // Gestion du 401 - Token invalide ou expiré
    if (response.status === 401) {
      redirectToLogin();
      throw new ApiError("Non authentifié", 401, "AUTH_REQUIRED");
    }
    
    return response;
  } catch (error) {
    // Si c'est déjà une ApiError, la relancer
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Erreur réseau
    console.error("❌ Erreur réseau:", error);
    throw new ApiError("Erreur de connexion au serveur", 0, "NETWORK_ERROR");
  }
};

/**
 * Appel API avec parsing JSON automatique
 * @param {string} url 
 * @param {object} options 
 * @returns {Promise<any>} - Données JSON
 */
export const apiJson = async (url, options = {}) => {
  const response = await apiFetch(url, options);
  
  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = { error: "Erreur serveur" };
    }
    throw new ApiError(
      errorData.error || "Erreur",
      response.status,
      errorData.code,
      errorData
    );
  }
  
  return response.json();
};

/**
 * Raccourcis pour les méthodes HTTP courantes
 */
export const api = {
  get: (url, options = {}) => apiJson(url, { ...options, method: "GET" }),
  
  post: (url, data, options = {}) => apiJson(url, {
    ...options,
    method: "POST",
    body: data instanceof FormData ? data : JSON.stringify(data)
  }),
  
  put: (url, data, options = {}) => apiJson(url, {
    ...options,
    method: "PUT",
    body: data instanceof FormData ? data : JSON.stringify(data)
  }),
  
  delete: (url, options = {}) => apiJson(url, { ...options, method: "DELETE" })
};

/**
 * Hook-like pour gérer le loading et les erreurs
 * Usage: const { execute, loading, error } = useApiCall();
 * 
 * Exemple d'utilisation dans un composant:
 * ```javascript
 * const [loading, setLoading] = useState(false);
 * const [error, setError] = useState(null);
 * 
 * const loadData = async () => {
 *   setLoading(true);
 *   setError(null);
 *   try {
 *     const data = await api.get('/api/users/roster');
 *     setUsers(data);
 *   } catch (err) {
 *     setError(err.message);
 *     handleApiError(err);
 *   } finally {
 *     setLoading(false);
 *   }
 * };
 * ```
 */

/**
 * Gestionnaire d'erreur global pour les appels API
 * @param {Error|ApiError} error 
 * @param {object} options 
 */
export const handleApiError = (error, options = {}) => {
  const { showAlert = true, onUnauthorized, onForbidden, onNotFound } = options;
  
  if (error instanceof ApiError) {
    switch (error.status) {
      case 401:
        if (onUnauthorized) onUnauthorized(error);
        else redirectToLogin();
        break;
        
      case 403:
        if (onForbidden) onForbidden(error);
        else if (showAlert) alert(error.message || "Accès refusé");
        break;
        
      case 404:
        if (onNotFound) onNotFound(error);
        else if (showAlert) alert(error.message || "Ressource introuvable");
        break;
        
      case 429:
        if (showAlert) alert("Trop de requêtes. Veuillez patienter.");
        break;
        
      default:
        if (showAlert) alert(error.message || "Erreur serveur");
    }
  } else {
    if (showAlert) alert("Erreur de connexion");
  }
  
  console.error("API Error:", error);
};

export default api;

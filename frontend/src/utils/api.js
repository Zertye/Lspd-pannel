// ============================================================================
// API HELPER - LSPD MDT
// ============================================================================

import { STORAGE_KEYS } from './constants';

const TOKEN_KEY = STORAGE_KEYS.TOKEN;
const TOKEN_EXPIRY_KEY = STORAGE_KEYS.TOKEN_EXPIRY;

export const isTokenExpired = () => {
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  if (!expiry) return true;
  return new Date().getTime() > parseInt(expiry);
};

export const getToken = () => {
  return localStorage.getItem(TOKEN_KEY);
};

export const setToken = (token, expiresInMs = 7 * 24 * 60 * 60 * 1000) => {
  localStorage.setItem(TOKEN_KEY, token);
  const expiryTime = new Date().getTime() + expiresInMs;
  localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
};

export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
};

const redirectToLogin = () => {
  clearToken();
  if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
    window.location.href = "/login";
  }
};

export class ApiError extends Error {
  constructor(message, status, code, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

export const apiFetch = async (url, options = {}) => {
  const token = getToken();
  
  if (token && isTokenExpired()) {
    redirectToLogin();
    throw new ApiError("Session expirée", 401, "TOKEN_EXPIRED");
  }
  
  const headers = { ...options.headers };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  
  try {
    const response = await fetch(url, { ...options, headers });
    
    if (response.status === 401) {
      redirectToLogin();
      throw new ApiError("Non authentifié", 401, "AUTH_REQUIRED");
    }
    
    return response;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error("❌ Erreur réseau:", error);
    throw new ApiError("Erreur de connexion au serveur", 0, "NETWORK_ERROR");
  }
};

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

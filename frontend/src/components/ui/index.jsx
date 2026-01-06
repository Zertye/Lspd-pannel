// ============================================================================
// COMPOSANTS UI - LSPD MDT
// Exemple de refactoring pour App.jsx
// ============================================================================

import React from 'react';
import { Link } from 'react-router-dom';
import { BADGE_VARIANTS, BUTTON_VARIANTS, STAT_CARD_COLORS } from '../utils/constants';

// ============================================================================
// BUTTON
// ============================================================================
export const Button = ({ 
  variant = "primary", 
  size = "md", 
  children, 
  className = "", 
  disabled = false,
  loading = false,
  ...props 
}) => {
  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };
  
  return (
    <button 
      className={`
        font-medium transition-colors rounded inline-flex items-center justify-center gap-2
        ${BUTTON_VARIANTS[variant]} 
        ${sizes[size]} 
        ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
};

// ============================================================================
// BADGE
// ============================================================================
export const Badge = ({ variant = "default", children, className = "" }) => {
  return (
    <span className={`
      inline-flex items-center px-2 py-0.5 text-xs font-medium rounded
      ${BADGE_VARIANTS[variant]} 
      ${className}
    `}>
      {children}
    </span>
  );
};

// ============================================================================
// CARD
// ============================================================================
export const Card = ({ children, className = "", noPadding = false, onClick }) => (
  <div 
    className={`
      bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded
      ${noPadding ? '' : 'p-5'}
      ${onClick ? 'cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition-colors' : ''}
      ${className}
    `}
    onClick={onClick}
  >
    {children}
  </div>
);

// ============================================================================
// STAT CARD
// ============================================================================
export const StatCard = ({ label, value, icon: Icon, color = "blue", subtitle }) => {
  return (
    <Card className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{value}</p>
        {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
      </div>
      <div className={`p-2.5 rounded ${STAT_CARD_COLORS[color]}`}>
        <Icon size={20}/>
      </div>
    </Card>
  );
};

// ============================================================================
// INPUT FIELD
// ============================================================================
export const InputField = ({ 
  label, 
  error, 
  helperText,
  className = "",
  ...props 
}) => (
  <div className={`mb-4 ${className}`}>
    {label && (
      <label className="block text-xs font-semibold uppercase tracking-wide mb-2 text-slate-600 dark:text-slate-400">
        {label}
      </label>
    )}
    <input 
      className={`
        w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-800 border rounded
        focus:ring-1 focus:ring-blue-500 outline-none transition-colors
        text-slate-900 dark:text-white
        ${error 
          ? 'border-red-500 focus:border-red-500' 
          : 'border-slate-300 dark:border-slate-600 focus:border-blue-500'
        }
      `}
      {...props} 
    />
    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    {helperText && !error && <p className="text-slate-400 text-xs mt-1">{helperText}</p>}
  </div>
);

// ============================================================================
// SELECT FIELD
// ============================================================================
export const SelectField = ({ 
  label, 
  children, 
  error,
  className = "",
  ...props 
}) => (
  <div className={`mb-4 ${className}`}>
    {label && (
      <label className="block text-xs font-semibold uppercase tracking-wide mb-2 text-slate-600 dark:text-slate-400">
        {label}
      </label>
    )}
    <select 
      className={`
        w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-800 border rounded
        focus:ring-1 focus:ring-blue-500 outline-none transition-colors
        text-slate-900 dark:text-white appearance-none cursor-pointer
        ${error 
          ? 'border-red-500' 
          : 'border-slate-300 dark:border-slate-600 focus:border-blue-500'
        }
      `}
      {...props}
    >
      {children}
    </select>
    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
  </div>
);

// ============================================================================
// TEXTAREA
// ============================================================================
export const TextArea = ({ 
  label, 
  error,
  className = "",
  ...props 
}) => (
  <div className={`mb-4 ${className}`}>
    {label && (
      <label className="block text-xs font-semibold uppercase tracking-wide mb-2 text-slate-600 dark:text-slate-400">
        {label}
      </label>
    )}
    <textarea 
      className={`
        w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-800 border rounded
        focus:ring-1 focus:ring-blue-500 outline-none transition-colors
        text-slate-900 dark:text-white min-h-[100px] resize-none
        ${error 
          ? 'border-red-500' 
          : 'border-slate-300 dark:border-slate-600 focus:border-blue-500'
        }
      `}
      {...props} 
    />
    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
  </div>
);

// ============================================================================
// MODAL
// ============================================================================
export const Modal = ({ 
  title, 
  children, 
  onClose, 
  size = "md",
  showCloseButton = true 
}) => {
  const sizes = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
  };
  
  // Fermer sur Escape
  React.useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);
  
  return (
    <div 
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className={`
          bg-white dark:bg-slate-800 w-full ${sizes[size]} rounded 
          border border-slate-200 dark:border-slate-700 shadow-xl
          animate-fade-in
        `}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
          {showCloseButton && (
            <button 
              onClick={onClose} 
              className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          )}
        </div>
        <div className="p-5">
          {children}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// LOADING SPINNER
// ============================================================================
export const LoadingSpinner = ({ size = "md", className = "" }) => {
  const sizes = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };
  
  return (
    <div className={`${sizes[size]} border-2 border-blue-600 border-t-transparent rounded-full animate-spin ${className}`} />
  );
};

// ============================================================================
// LOADING PAGE
// ============================================================================
export const LoadingPage = () => (
  <div className="flex items-center justify-center py-20">
    <LoadingSpinner size="md" />
  </div>
);

// ============================================================================
// EMPTY STATE
// ============================================================================
export const EmptyState = ({ 
  icon: Icon, 
  title, 
  description, 
  action,
  actionLabel,
  className = "" 
}) => (
  <div className={`text-center py-12 ${className}`}>
    {Icon && (
      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
        <Icon size={32} className="text-slate-400" />
      </div>
    )}
    <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
      {title}
    </h3>
    {description && (
      <p className="text-slate-500 text-sm max-w-md mx-auto mb-4">
        {description}
      </p>
    )}
    {action && actionLabel && (
      <Button onClick={action}>{actionLabel}</Button>
    )}
  </div>
);

// ============================================================================
// SIDEBAR ITEM (pour Layout)
// ============================================================================
export const SidebarItem = ({ icon: Icon, label, to, active, badge }) => {
  return (
    <Link 
      to={to} 
      className={`
        flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors rounded
        ${active 
          ? 'bg-blue-600 text-white' 
          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
        }
      `}
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
};

// ============================================================================
// EXPORTS PAR DÉFAUT
// ============================================================================
export default {
  Button,
  Badge,
  Card,
  StatCard,
  InputField,
  SelectField,
  TextArea,
  Modal,
  LoadingSpinner,
  LoadingPage,
  EmptyState,
  SidebarItem
};

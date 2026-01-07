import { BUTTON_VARIANTS } from '../../utils/constants';

export function Button({ 
  variant = "primary", 
  size = "md", 
  children, 
  className = "", 
  disabled = false,
  loading = false,
  ...props 
}) {
  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };
  
  return (
    <button 
      className={`font-medium transition-colors rounded inline-flex items-center justify-center gap-2 ${BUTTON_VARIANTS[variant]} ${sizes[size]} ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
}

export default Button;

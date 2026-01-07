export function SelectField({ 
  label, 
  children, 
  error,
  className = "",
  ...props 
}) {
  return (
    <div className={`mb-4 ${className}`}>
      {label && (
        <label className="block text-xs font-semibold uppercase tracking-wide mb-2 text-slate-600 dark:text-slate-400">
          {label}
        </label>
      )}
      <select 
        className={`w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-800 border rounded focus:ring-1 focus:ring-blue-500 outline-none transition-colors text-slate-900 dark:text-white appearance-none cursor-pointer ${error ? 'border-red-500' : 'border-slate-300 dark:border-slate-600 focus:border-blue-500'}`}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

export default SelectField;

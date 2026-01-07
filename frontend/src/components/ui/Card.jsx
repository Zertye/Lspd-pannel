export function Card({ children, className = "", noPadding = false, onClick }) {
  return (
    <div 
      className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded ${noPadding ? '' : 'p-5'} ${onClick ? 'cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition-colors' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export default Card;

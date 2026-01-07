import { Link } from 'react-router-dom';

export function SidebarItem({ icon: Icon, label, to, active, badge }) {
  return (
    <Link 
      to={to} 
      className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors rounded ${active ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
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

export default SidebarItem;

import { STAT_CARD_COLORS } from '../../utils/constants';
import Card from './Card';

export function StatCard({ label, value, icon: Icon, color = "blue", subtitle }) {
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
}

export default StatCard;

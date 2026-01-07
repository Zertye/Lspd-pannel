import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ClipboardList, Radio, Car, Timer, ChevronRight, Users, Activity,
  Crown, Trash2, Plus, Pencil, AlertCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../utils/api';
import { formatDuration, formatDurationLong } from '../utils/constants';
import { Layout } from '../components/layout';
import { Card, StatCard, Badge, LoadingPage } from '../components/ui';

export function Dashboard() {
  const { user, hasPerm } = useAuth();
  const [myStats, setMyStats] = useState(null);
  const [serviceStatus, setServiceStatus] = useState(null);
  const [patrolTimes, setPatrolTimes] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = hasPerm("view_logs");

  useEffect(() => {
    const loadData = async () => {
      try {
        const statsRes = await apiFetch("/api/users/me/stats");
        if (statsRes && statsRes.ok) setMyStats(await statsRes.json());

        const serviceRes = await apiFetch("/api/centrale/service/status");
        if (serviceRes && serviceRes.ok) setServiceStatus(await serviceRes.json());

        if (isAdmin) {
          const patrolRes = await apiFetch("/api/centrale/patrol-times");
          if (patrolRes && patrolRes.ok) setPatrolTimes(await patrolRes.json());

          const activityRes = await apiFetch("/api/admin/logs?limit=10");
          if (activityRes && activityRes.ok) setRecentActivity(await activityRes.json());
        }
      } catch (e) {
        console.error("Dashboard load error:", e);
      }
      setLoading(false);
    };
    loadData();
  }, [isAdmin]);

  if (loading) {
    return <Layout><LoadingPage /></Layout>;
  }

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Bienvenue, {user ? user.first_name : ""}
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {user ? user.grade_name : ""} - Matricule {user && user.badge_number ? user.badge_number : "N/A"}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard 
          label="Plaintes traitées" 
          value={myStats ? myStats.my_appointments || 0 : 0} 
          icon={ClipboardList} 
          color="blue" 
        />
        <StatCard 
          label="Temps de patrouille" 
          value={formatDuration(user ? user.total_patrol_time || 0 : 0)} 
          icon={Timer} 
          color="green" 
        />
        <StatCard 
          label="Statut" 
          value={serviceStatus && serviceStatus.isOnDuty ? "En service" : "Hors service"} 
          icon={Radio} 
          color={serviceStatus && serviceStatus.isOnDuty ? "green" : "yellow"} 
        />
        <StatCard 
          label="Patrouille" 
          value={serviceStatus && serviceStatus.patrol ? serviceStatus.patrol.name : "Aucune"} 
          icon={Car} 
          color="purple" 
        />
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Ma Patrouille */}
        <Card className="lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
            Ma Patrouille
          </h2>
          
          {serviceStatus && serviceStatus.isOnDuty ? (
            serviceStatus.patrol ? (
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded flex items-center justify-center ${
                  serviceStatus.patrol.status === "emergency" ? "bg-red-50 dark:bg-red-900/20" :
                  serviceStatus.patrol.status === "busy" ? "bg-amber-50 dark:bg-amber-900/20" :
                  "bg-emerald-50 dark:bg-emerald-900/20"
                }`}>
                  <Car size={24} className={
                    serviceStatus.patrol.status === "emergency" ? "text-red-600" :
                    serviceStatus.patrol.status === "busy" ? "text-amber-600" :
                    "text-emerald-600"
                  }/>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-900 dark:text-white">{serviceStatus.patrol.name}</p>
                  {serviceStatus.patrol.call_sign && (
                    <p className="text-blue-600 font-mono text-sm">{serviceStatus.patrol.call_sign}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    <Badge variant={
                      serviceStatus.patrol.status === "emergency" ? "danger" :
                      serviceStatus.patrol.status === "busy" ? "warning" : "success"
                    }>
                      {serviceStatus.patrol.status === "emergency" ? "URGENCE" :
                       serviceStatus.patrol.status === "busy" ? "OCCUPÉ" : "DISPONIBLE"}
                    </Badge>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <AlertCircle size={32} className="text-amber-500 mx-auto mb-2"/>
                <p className="text-slate-600 dark:text-slate-300 font-medium">Aucune patrouille assignée</p>
                <Link to="/centrale" className="text-blue-600 text-sm hover:underline mt-1 inline-block">
                  Rejoindre une patrouille
                </Link>
              </div>
            )
          ) : (
            <div className="text-center py-6">
              <Radio size={32} className="text-slate-400 mx-auto mb-2"/>
              <p className="text-slate-500 font-medium">Hors service</p>
              <Link to="/centrale" className="text-blue-600 text-sm hover:underline mt-1 inline-block">
                Prendre son service
              </Link>
            </div>
          )}
        </Card>

        {/* Actions Rapides */}
        <Card>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
            Actions Rapides
          </h2>
          <div className="space-y-2">
            <Link 
              to="/centrale" 
              className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <Radio size={18} className="text-blue-600"/>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Ouvrir la Centrale</span>
              <ChevronRight size={16} className="ml-auto text-slate-400"/>
            </Link>
            <Link 
              to="/plaintes" 
              className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <ClipboardList size={18} className="text-amber-600"/>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Gérer les Plaintes</span>
              <ChevronRight size={16} className="ml-auto text-slate-400"/>
            </Link>
            <Link 
              to="/roster" 
              className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <Users size={18} className="text-purple-600"/>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Voir les Effectifs</span>
              <ChevronRight size={16} className="ml-auto text-slate-400"/>
            </Link>
          </div>
        </Card>
      </div>

      {/* Admin Section */}
      {isAdmin && (
        <div className="grid lg:grid-cols-3 gap-6 mt-6">
          {/* Classement Temps de Patrouille */}
          <Card noPadding className="lg:col-span-2 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Timer size={18} className="text-blue-600"/>
                Classement Temps de Patrouille
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase font-medium text-slate-500">
                  <tr>
                    <th className="px-5 py-3 text-left">#</th>
                    <th className="px-5 py-3 text-left">Officier</th>
                    <th className="px-5 py-3 text-left">Grade</th>
                    <th className="px-5 py-3 text-right">Temps Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {patrolTimes.slice(0, 8).map((p, i) => (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-5 py-3 w-12">
                        {i === 0 ? <Crown size={16} className="text-amber-500"/> :
                         <span className="text-slate-400 font-medium">{i + 1}</span>}
                      </td>
                      <td className="px-5 py-3 font-medium text-slate-800 dark:text-white">
                        {p.first_name} {p.last_name}
                      </td>
                      <td className="px-5 py-3">
                        <span 
                          className="px-2 py-1 rounded text-xs font-medium"
                          style={{backgroundColor: p.grade_color + "15", color: p.grade_color}}
                        >
                          {p.grade_name}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-slate-600 dark:text-slate-300">
                        {formatDurationLong(p.total_patrol_time || 0)}
                      </td>
                    </tr>
                  ))}
                  {patrolTimes.length === 0 && (
                    <tr>
                      <td colSpan="4" className="px-5 py-8 text-center text-slate-400">
                        Aucune donnée
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Activité Récente */}
          <Card noPadding className="overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Activity size={18} className="text-purple-600"/>
                Activité Récente
              </h2>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {recentActivity.length > 0 ? (
                <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {recentActivity.map((log, i) => (
                    <div key={i} className="px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <div className="flex items-start gap-3">
                        <div className={`w-7 h-7 rounded flex items-center justify-center flex-shrink-0 ${
                          log.action && log.action.includes("DELETE") ? "bg-red-50 dark:bg-red-900/20 text-red-600" :
                          log.action && log.action.includes("CREATE") ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600" :
                          "bg-blue-50 dark:bg-blue-900/20 text-blue-600"
                        }`}>
                          {log.action && log.action.includes("DELETE") ? <Trash2 size={14}/> :
                           log.action && log.action.includes("CREATE") ? <Plus size={14}/> :
                           <Pencil size={14}/>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-800 dark:text-white font-medium truncate">
                            {log.first_name} {log.last_name}
                          </p>
                          <p className="text-xs text-slate-500 truncate">{log.action}</p>
                        </div>
                        <span className="text-xs text-slate-400 flex-shrink-0">
                          {new Date(log.created_at).toLocaleTimeString("fr-FR", {
                            hour: "2-digit", minute: "2-digit"
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-5 py-8 text-center text-slate-400">
                  Aucune activité
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </Layout>
  );
}

export default Dashboard;

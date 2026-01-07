import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { Layout } from '../components/layout';
import { Card, LoadingPage } from '../components/ui';

export function Roster() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    apiFetch("/api/users/roster")
      .then(r => r ? r.json() : [])
      .then(d => setMembers(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);
  
  const order = ["High Command", "Command Staff", "Supervisors", "Officers", "Système"];
  const grouped = members.reduce((acc, m) => {
    const cat = m.grade_category || "Autres";
    if(!acc[cat]) acc[cat] = [];
    acc[cat].push(m);
    return acc;
  }, {});

  if (loading) {
    return <Layout><LoadingPage /></Layout>;
  }

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Effectifs LSPD</h1>
        <p className="text-slate-500 text-sm mt-1">Liste des officiers et état-major</p>
      </div>
      
      <div className="space-y-8">
        {order.map(cat => {
          if (!grouped[cat]) return null;
          return (
            <div key={cat}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-blue-600 mb-3 pb-2 border-b border-slate-200 dark:border-slate-700">
                {cat}
              </h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                {grouped[cat].sort((a,b) => b.grade_level - a.grade_level).map(m => (
                  <Card key={m.id} className="flex items-center gap-4 border-l-2" style={{borderLeftColor: m.grade_color}}>
                    <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded flex items-center justify-center font-medium text-slate-500 overflow-hidden text-sm border border-slate-300 dark:border-slate-600">
                      {m.profile_picture ? (
                        <img src={m.profile_picture} className="w-full h-full object-cover" alt="" />
                      ) : (m.first_name ? m.first_name[0] : "?")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 dark:text-white text-sm">{m.grade_name}</p>
                      <p className="text-xs text-slate-500">{m.last_name} {m.first_name}</p>
                      <p className="text-xs font-mono text-slate-400 mt-0.5">Mle: {m.badge_number || "N/A"}</p>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Layout>
  );
}

export default Roster;

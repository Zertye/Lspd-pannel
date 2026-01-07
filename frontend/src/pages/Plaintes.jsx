import { useState, useEffect } from 'react';
import { Phone, RefreshCw, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../utils/api';
import { Layout } from '../components/layout';
import { Card, Button, Badge, LoadingPage } from '../components/ui';

export function Plaintes() {
  const { hasPerm } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const load = () => {
    setLoading(true);
    apiFetch("/api/appointments")
      .then(r => r ? r.json() : [])
      .then(d => setComplaints(Array.isArray(d) ? d : []))
      .catch(() => setComplaints([]))
      .finally(() => setLoading(false));
  };
  
  useEffect(() => { load(); }, []);
  
  const handleStatus = async (id, action) => {
    await apiFetch("/api/appointments/" + id + "/" + action, { method: "POST" });
    load();
  };

  const deleteComplaint = async (id) => {
    if (!hasPerm("delete_appointments")) return;
    if (window.confirm("Supprimer définitivement ce dossier ?")) {
      await apiFetch("/api/appointments/" + id, { method: "DELETE" });
      load();
    }
  };

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Plaintes et Requêtes</h1>
          <p className="text-slate-500 text-sm mt-1">Gestion des dossiers citoyens</p>
        </div>
        <Button variant="ghost" onClick={load}>
          <RefreshCw size={18}/>
        </Button>
      </div>
      
      {loading ? (
        <LoadingPage />
      ) : (
        <div className="space-y-3">
          {complaints.map(c => (
            <Card key={c.id} className="flex flex-col md:flex-row justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={
                    c.status === "pending" ? "warning" : 
                    c.status === "assigned" ? "info" : 
                    c.status === "cancelled" ? "danger" : "success"
                  }>
                    {c.status === "pending" ? "En Attente" : 
                     c.status === "assigned" ? "En Cours" : 
                     c.status === "cancelled" ? "Refusée" : "Clôturée"}
                  </Badge>
                  <span className="text-slate-400 text-xs font-mono">
                    #{c.id} - {new Date(c.created_at).toLocaleDateString()}
                  </span>
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  {c.appointment_type} - {c.patient_name}
                </h3>
                <p className="text-slate-500 text-sm mt-1 line-clamp-2">{c.description}</p>
                <div className="flex gap-4 text-xs text-slate-400 mt-2 font-mono">
                  <span className="flex items-center gap-1"><Phone size={12}/> {c.patient_phone || "N/A"}</span>
                  {c.medic_first_name && <span>Assigné: {c.medic_first_name} {c.medic_last_name}</span>}
                </div>
              </div>
              
              <div className="flex md:flex-col gap-2 pt-4 md:pt-0 md:pl-4 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700 justify-center items-center">
                {hasPerm("manage_appointments") && (
                  <>
                    {c.status === "pending" && (
                      <Button size="sm" onClick={() => handleStatus(c.id, "assign")}>
                        Prendre en charge
                      </Button>
                    )}
                    {c.status === "assigned" && (
                      <Button variant="success" size="sm" onClick={() => handleStatus(c.id, "complete")}>
                        Clôturer
                      </Button>
                    )}
                    {c.status !== "completed" && c.status !== "cancelled" && (
                      <Button variant="ghost" size="sm" onClick={() => handleStatus(c.id, "cancel")} className="text-red-500">
                        Refuser
                      </Button>
                    )}
                  </>
                )}
                
                {hasPerm("delete_appointments") && (
                  <button 
                    onClick={() => deleteComplaint(c.id)} 
                    className="p-2 text-slate-400 hover:text-red-500"
                  >
                    <Trash2 size={16}/>
                  </button>
                )}
              </div>
            </Card>
          ))}
          {complaints.length === 0 && (
            <div className="text-center py-12 text-slate-400 bg-slate-800/50 rounded border border-dashed border-slate-700">
              Aucune plainte à traiter
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}

export default Plaintes;

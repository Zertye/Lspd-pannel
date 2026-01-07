import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, CheckCircle } from 'lucide-react';
import { Button, InputField, SelectField, TextArea } from '../components/ui';

export function PublicComplaint() {
  const [form, setForm] = useState({ 
    patient_name: "", patient_phone: "", patient_discord: "", 
    appointment_type: "Vol", description: "" 
  });
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  
  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/appointments/public", { 
        method: "POST", 
        headers: {"Content-Type":"application/json"}, 
        body: JSON.stringify(form) 
      });
      if (res.ok) setDone(true);
      else {
        const err = await res.json();
        alert(err.error || "Erreur lors de l'envoi");
      }
    } catch (ex) {
      alert("Erreur de connexion");
    }
    setLoading(false);
  };
  
  if(done) return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 bg-emerald-600 rounded flex items-center justify-center text-white mb-6">
        <CheckCircle size={32}/>
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">Plainte Enregistrée</h1>
      <p className="text-slate-400 mb-8 max-w-md text-sm">
        Votre déclaration a été transmise aux services du LSPD.
      </p>
      <Button onClick={() => navigate("/")}>Retour accueil</Button>
    </div>
  );
  
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white dark:bg-slate-800 p-6 rounded border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-4 mb-6 pb-4 border-b border-slate-200 dark:border-slate-700">
          <div className="w-10 h-10 bg-blue-600 rounded flex items-center justify-center">
            <Shield size={20} className="text-white"/>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">Déposer une Plainte</h1>
            <p className="text-slate-500 text-xs">Formulaire officiel LSPD</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <InputField label="Identité (Nom Prénom)" placeholder="Maurice Latoue" value={form.patient_name} onChange={(e) => setForm({...form, patient_name: e.target.value})} required />
          <div className="grid grid-cols-2 gap-4">
            <InputField label="Téléphone" placeholder="555-0100" value={form.patient_phone} onChange={(e) => setForm({...form, patient_phone: e.target.value})} />
            <InputField label="Discord" placeholder="pseudo#0000" value={form.patient_discord} onChange={(e) => setForm({...form, patient_discord: e.target.value})} />
          </div>
          <SelectField label="Motif de la plainte" value={form.appointment_type} onChange={(e) => setForm({...form, appointment_type: e.target.value})}>
            <option value="Vol">Vol / Cambriolage</option>
            <option value="Agression">Agression / Coups et blessures</option>
            <option value="Menace">Menaces / Harcèlement</option>
            <option value="Degradation">Dégradation de biens</option>
            <option value="Autre">Autre motif</option>
          </SelectField>
          <TextArea label="Description des faits" placeholder="Décrivez ce qui s'est passé..." value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} required />
          <div className="pt-4 flex gap-3">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : "Envoyer"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PublicComplaint;

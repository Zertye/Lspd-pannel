import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button, InputField } from '../components/ui';

export function Login() {
  const { login, user, authChecked } = useAuth();
  const [form, setForm] = useState({ username: "", password: "" });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  
  useEffect(() => {
    if (authChecked && user) {
      navigate("/dashboard");
    }
  }, [authChecked, user, navigate]);
  
  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const res = await login(form.username, form.password);
    setLoading(false);
    if(res.success) {
      navigate("/dashboard");
    } else {
      setErr(res.error || "Erreur d'identification");
    }
  };
  
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-slate-800 p-6 rounded border border-slate-700">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-blue-600 rounded flex items-center justify-center mx-auto mb-4">
            <Shield size={28} className="text-white"/>
          </div>
          <h1 className="text-xl font-bold text-white">LSPD Intranet</h1>
          <p className="text-slate-500 text-xs mt-1">Accès réservé aux officiers</p>
        </div>
        
        {err && (
          <div className="bg-red-900/30 text-red-400 px-3 py-2 rounded mb-4 text-sm text-center border border-red-800">
            {err}
          </div>
        )}
        
        <form onSubmit={submit} className="space-y-4">
          <InputField 
            label="Identifiant" 
            value={form.username} 
            onChange={(e) => setForm({...form, username: e.target.value})}
            autoComplete="username"
          />
          <div className="relative">
            <InputField 
              label="Mot de passe" 
              type={showPassword ? "text" : "password"} 
              value={form.password} 
              onChange={(e) => setForm({...form, password: e.target.value})} 
            />
            <button 
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-8 text-slate-400 hover:text-white"
            >
              {showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
            </button>
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
            ) : "Connexion"}
          </Button>
        </form>
        
        <div className="mt-6 text-center">
          <Link to="/plainte" className="text-slate-500 hover:text-white text-xs font-medium transition-colors">
            Déposer une plainte (Civil)
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Login;

import { Link } from 'react-router-dom';
import { Shield, Lock, FileText } from 'lucide-react';
import { Button } from '../components/ui';

export function Landing() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center relative">
      <div className="text-center space-y-6 p-6">
        <div className="w-20 h-20 bg-blue-600 rounded flex items-center justify-center mx-auto">
          <Shield size={40} className="text-white"/>
        </div>
        <div>
          <h1 className="text-4xl font-bold text-white tracking-tight">L.S.P.D</h1>
          <p className="text-blue-500 text-sm font-medium uppercase tracking-widest mt-1">
            Los Santos Police Department
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 pt-6">
          <Link to="/login">
            <Button size="lg" className="w-full sm:w-auto flex items-center gap-2">
              <Lock size={18}/> Accès Officier
            </Button>
          </Link>
          <Link to="/plainte">
            <Button variant="secondary" size="lg" className="w-full sm:w-auto flex items-center gap-2">
              <FileText size={18}/> Porter Plainte
            </Button>
          </Link>
        </div>
      </div>
      <div className="absolute bottom-4 text-slate-600 text-xs font-mono">
        SECURE CONNECTION - AUTHORIZED PERSONNEL ONLY
      </div>
    </div>
  );
}

export default Landing;

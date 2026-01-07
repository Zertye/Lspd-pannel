import { useState, useEffect, useCallback } from 'react';
import { 
  Radio, Users, Car, MapPin, Clock, Plus, MessageSquare,
  AlertCircle, Siren, Pin, Crown, Headphones, X, CheckCircle,
  PlayCircle, StopCircle, RefreshCw, Pencil, Trash2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../utils/api';
import { formatDuration, PATROL_STATUSES, getPatrolStatus, CALL_TYPES } from '../utils/constants';
import { Layout } from '../components/layout';
import { Card, Button, Badge, Modal, InputField, SelectField, TextArea, LoadingPage } from '../components/ui';

export function Centrale() {
  const { user, hasPerm } = useAuth();
  const [serviceStatus, setServiceStatus] = useState(null);
  const [onlineOfficers, setOnlineOfficers] = useState([]);
  const [patrols, setPatrols] = useState([]);
  const [notes, setNotes] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [currentOperator, setCurrentOperator] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [showPatrolModal, setShowPatrolModal] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingPatrol, setEditingPatrol] = useState(null);
  const [selectedPatrol, setSelectedPatrol] = useState(null);
  
  const [patrolForm, setPatrolForm] = useState({ name: "", call_sign: "", vehicle: "", sector: "", notes: "" });
  const [dispatchForm, setDispatchForm] = useState({ call_type: "", location: "", description: "", priority: 0, patrol_id: "" });
  const [noteForm, setNoteForm] = useState({ content: "", note_type: "info", patrol_id: "", is_pinned: false });

  const loadData = useCallback(async () => {
    try {
      const [statusRes, onlineRes, patrolsRes, notesRes, dispatchRes, operatorRes] = await Promise.all([
        apiFetch("/api/centrale/service/status"),
        apiFetch("/api/centrale/service/online"),
        apiFetch("/api/centrale/patrols"),
        apiFetch("/api/centrale/notes?limit=30"),
        apiFetch("/api/centrale/dispatch?limit=20"),
        apiFetch("/api/centrale/operator/current")
      ]);

      if (statusRes && statusRes.ok) setServiceStatus(await statusRes.json());
      if (onlineRes && onlineRes.ok) {
        const data = await onlineRes.json();
        setOnlineOfficers(data.officers || []);
      }
      if (patrolsRes && patrolsRes.ok) setPatrols(await patrolsRes.json());
      if (notesRes && notesRes.ok) setNotes(await notesRes.json());
      if (dispatchRes && dispatchRes.ok) setDispatches(await dispatchRes.json());
      if (operatorRes && operatorRes.ok) {
        const data = await operatorRes.json();
        setCurrentOperator(data.operator);
      }
    } catch (e) {
      console.error("Centrale load error:", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  const startService = async () => {
    const res = await apiFetch("/api/centrale/service/start", { method: "POST" });
    if (res && res.ok) loadData();
    else {
      const err = res ? await res.json() : {};
      alert(err.error || "Erreur");
    }
  };

  const endService = async () => {
    if (!window.confirm("Terminer votre service ?")) return;
    const res = await apiFetch("/api/centrale/service/end", { method: "POST" });
    if (res && res.ok) loadData();
  };

  const openCreatePatrol = () => {
    setPatrolForm({ name: "", call_sign: "", vehicle: "", sector: "", notes: "" });
    setEditingPatrol(null);
    setShowPatrolModal(true);
  };

  const openEditPatrol = (patrol) => {
    setPatrolForm({
      name: patrol.name,
      call_sign: patrol.call_sign || "",
      vehicle: patrol.vehicle || "",
      sector: patrol.sector || "",
      notes: patrol.notes || ""
    });
    setEditingPatrol(patrol);
    setShowPatrolModal(true);
  };

  const savePatrol = async (e) => {
    e.preventDefault();
    const method = editingPatrol ? "PUT" : "POST";
    const url = editingPatrol ? "/api/centrale/patrols/" + editingPatrol.id : "/api/centrale/patrols";
    
    const res = await apiFetch(url, { method, body: JSON.stringify(patrolForm) });
    if (res && res.ok) {
      setShowPatrolModal(false);
      loadData();
    }
  };

  const deletePatrol = async (id) => {
    if (!window.confirm("Supprimer cette patrouille ?")) return;
    await apiFetch("/api/centrale/patrols/" + id, { method: "DELETE" });
    loadData();
  };

  const updatePatrolStatus = async (patrolId, status) => {
    await apiFetch("/api/centrale/patrols/" + patrolId, { 
      method: "PUT", 
      body: JSON.stringify({ status }) 
    });
    loadData();
  };

  const openAssignModal = (patrol) => {
    setSelectedPatrol(patrol);
    setShowAssignModal(true);
  };

  const assignOfficer = async (userId) => {
    await apiFetch("/api/centrale/patrols/" + selectedPatrol.id + "/assign", {
      method: "POST",
      body: JSON.stringify({ userId })
    });
    loadData();
  };

  const unassignOfficer = async (patrolId, odUserId) => {
    await apiFetch("/api/centrale/patrols/" + patrolId + "/unassign", {
      method: "POST",
      body: JSON.stringify({ userId: odUserId })
    });
    loadData();
  };

  const setLeader = async (patrolId, odUserId) => {
    await apiFetch("/api/centrale/patrols/" + patrolId + "/leader", {
      method: "POST",
      body: JSON.stringify({ userId: odUserId })
    });
    loadData();
  };

  const assignOperator = async (odUserId) => {
    await apiFetch("/api/centrale/operator/assign", {
      method: "POST",
      body: JSON.stringify({ userId: odUserId })
    });
    loadData();
  };

  const forceEndService = async (odUserId, officerName) => {
    if (!window.confirm("Forcer la fin de service de " + officerName + " ?")) return;
    await apiFetch("/api/centrale/service/force-end", {
      method: "POST",
      body: JSON.stringify({ userId: odUserId })
    });
    loadData();
  };

  const saveNote = async (e) => {
    e.preventDefault();
    await apiFetch("/api/centrale/notes", { method: "POST", body: JSON.stringify(noteForm) });
    setShowNoteModal(false);
    setNoteForm({ content: "", note_type: "info", patrol_id: "", is_pinned: false });
    loadData();
  };

  const deleteNote = async (id) => {
    await apiFetch("/api/centrale/notes/" + id, { method: "DELETE" });
    loadData();
  };

  const togglePinNote = async (id) => {
    await apiFetch("/api/centrale/notes/" + id + "/pin", { method: "POST" });
    loadData();
  };

  const saveDispatch = async (e) => {
    e.preventDefault();
    await apiFetch("/api/centrale/dispatch", { method: "POST", body: JSON.stringify(dispatchForm) });
    setShowDispatchModal(false);
    setDispatchForm({ call_type: "", location: "", description: "", priority: 0, patrol_id: "" });
    loadData();
  };

  const updateDispatchStatus = async (id, status) => {
    await apiFetch("/api/centrale/dispatch/" + id + "/status", {
      method: "POST",
      body: JSON.stringify({ status })
    });
    loadData();
  };

  const availableOfficers = onlineOfficers.filter(o => !o.patrol_id);

  if (loading) {
    return <Layout><LoadingPage /></Layout>;
  }

  // Écran hors service
  if (!serviceStatus || !serviceStatus.isOnDuty) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 bg-slate-800 rounded flex items-center justify-center mb-6 border border-slate-700">
            <Radio size={32} className="text-slate-500"/>
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Centrale LSPD</h1>
          <p className="text-slate-500 mb-8 text-center max-w-md text-sm">
            Prenez votre service pour accéder à la centrale et aux patrouilles.
          </p>
          <Button onClick={startService} size="lg" className="flex items-center gap-2">
            <PlayCircle size={20}/>
            Prendre son service
          </Button>
        </div>
      </Layout>
    );
  }

  const canManage = serviceStatus.canManageCentrale || (user && user.grade_level === 99);

  return (
    <Layout>
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Radio className="text-purple-600" size={24}/>
            Centrale
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {onlineOfficers.length} officier{onlineOfficers.length > 1 ? "s" : ""} en service
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={loadData} className="p-2">
            <RefreshCw size={18}/>
          </Button>
          <Button variant="danger" onClick={endService} className="flex items-center gap-2">
            <StopCircle size={16}/> Fin de service
          </Button>
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-slate-800 border border-slate-700 rounded p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <div>
              <p className="text-emerald-400 font-medium text-sm">
                En service depuis {formatDuration(serviceStatus.service ? serviceStatus.service.current_duration : 0)}
              </p>
              {serviceStatus.patrol && (
                <p className="text-xs text-slate-400">
                  Patrouille: {serviceStatus.patrol.name}
                  {serviceStatus.patrol.call_sign && " (" + serviceStatus.patrol.call_sign + ")"}
                </p>
              )}
            </div>
          </div>
          {currentOperator && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-900/20 border border-purple-800 rounded text-xs">
              <Headphones size={14} className="text-purple-400"/>
              <span className="text-purple-300">
                Opérateur: <span className="font-medium text-white">{currentOperator.first_name} {currentOperator.last_name}</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Officers Online */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Users size={18} className="text-blue-600"/>
              En Service ({onlineOfficers.length})
            </h2>
          </div>

          <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
            {onlineOfficers.map(officer => (
              <Card 
                key={officer.id} 
                className={officer.is_operator ? "border-purple-500" : officer.patrol_id ? "border-blue-500/50" : ""}
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="w-9 h-9 rounded bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden border-2 text-xs font-medium"
                    style={{borderColor: officer.grade_color}}
                  >
                    {officer.profile_picture ? (
                      <img src={officer.profile_picture} className="w-full h-full object-cover" alt="" />
                    ) : (officer.first_name ? officer.first_name[0] : "?")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-800 dark:text-white text-sm truncate">
                        {officer.first_name} {officer.last_name}
                      </p>
                      {officer.is_operator && <Headphones size={12} className="text-purple-400 flex-shrink-0"/>}
                    </div>
                    <p className="text-xs truncate" style={{color: officer.grade_color}}>{officer.grade_name}</p>
                    {officer.patrol_name && (
                      <p className="text-xs text-blue-500 truncate">{officer.patrol_call_sign || officer.patrol_name}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-mono text-slate-500">{formatDuration(officer.duration)}</p>
                    {!officer.patrol_id && <Badge variant="warning">Dispo</Badge>}
                  </div>
                </div>
                
                {canManage && !officer.patrol_id && (
                  <div className="flex gap-1 mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => assignOperator(officer.id)}
                      className="flex-1 text-purple-500"
                    >
                      <Headphones size={12} className="mr-1"/> Centrale
                    </Button>
                  </div>
                )}
                
                {hasPerm("force_end_service") && user && officer.id !== user.id && (
                  <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => forceEndService(officer.id, officer.first_name + " " + officer.last_name)}
                      className="w-full text-red-500"
                    >
                      <StopCircle size={12} className="mr-1"/> Forcer fin service
                    </Button>
                  </div>
                )}
              </Card>
            ))}
            {onlineOfficers.length === 0 && (
              <div className="text-center py-8 text-slate-400 bg-slate-800/50 rounded border border-dashed border-slate-700">
                Aucun officier en service
              </div>
            )}
          </div>
        </div>

        {/* Patrols Section */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Car size={18} className="text-emerald-600"/>
              Patrouilles
            </h2>
            {canManage && (
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setShowDispatchModal(true)}>
                  <Siren size={14} className="mr-1"/> Appel
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setShowNoteModal(true)}>
                  <MessageSquare size={14} className="mr-1"/> Note
                </Button>
                <Button size="sm" onClick={openCreatePatrol}>
                  <Plus size={14} className="mr-1"/> Patrouille
                </Button>
              </div>
            )}
          </div>

          {/* Patrols Grid */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            {patrols.map(patrol => {
              const statusInfo = getPatrolStatus(patrol.status);
              const StatusIcon = statusInfo.id === "available" ? CheckCircle :
                               statusInfo.id === "busy" ? AlertCircle :
                               statusInfo.id === "emergency" ? Siren :
                               statusInfo.id === "break" ? Clock : X;
              
              return (
                <Card 
                  key={patrol.id} 
                  noPadding
                  className={patrol.status === "emergency" ? "border-red-500" : patrol.status === "busy" ? "border-amber-500" : ""}
                >
                  <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded flex items-center justify-center ${statusInfo.bgLight} ${statusInfo.bgDark}`}>
                          <StatusIcon size={18} className={statusInfo.text}/>
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-800 dark:text-white text-sm">{patrol.name}</h3>
                          {patrol.call_sign && (
                            <p className="text-xs font-mono text-blue-600">{patrol.call_sign}</p>
                          )}
                        </div>
                      </div>
                      {canManage && (
                        <div className="flex gap-1">
                          <button onClick={() => openEditPatrol(patrol)} className="p-1.5 text-slate-400 hover:text-blue-500">
                            <Pencil size={14}/>
                          </button>
                          <button onClick={() => deletePatrol(patrol.id)} className="p-1.5 text-slate-400 hover:text-red-500">
                            <Trash2 size={14}/>
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 mt-3 text-xs">
                      {patrol.vehicle && (
                        <span className="flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded">
                          <Car size={12}/> {patrol.vehicle}
                        </span>
                      )}
                      {patrol.sector && (
                        <span className="flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded">
                          <MapPin size={12}/> {patrol.sector}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-slate-500 uppercase">
                        Équipage ({patrol.member_count || 0})
                      </span>
                      {canManage && (
                        <button 
                          onClick={() => openAssignModal(patrol)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          + Ajouter
                        </button>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      {patrol.members && patrol.members.map(m => (
                        <div key={m.id} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-700/50 rounded">
                          <div className="w-6 h-6 rounded bg-slate-200 dark:bg-slate-600 flex items-center justify-center overflow-hidden text-xs font-medium">
                            {m.profile_picture ? (
                              <img src={m.profile_picture} className="w-full h-full object-cover" alt="" />
                            ) : (m.first_name ? m.first_name[0] : "?")}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-800 dark:text-white truncate flex items-center gap-1">
                              {m.first_name} {m.last_name}
                              {m.role === "leader" && <Crown size={10} className="text-amber-500"/>}
                            </p>
                          </div>
                          {canManage && (
                            <div className="flex gap-1">
                              {m.role !== "leader" && (
                                <button 
                                  onClick={() => setLeader(patrol.id, m.id)}
                                  className="p-1 text-slate-400 hover:text-amber-500"
                                >
                                  <Crown size={12}/>
                                </button>
                              )}
                              <button 
                                onClick={() => unassignOfficer(patrol.id, m.id)}
                                className="p-1 text-slate-400 hover:text-red-500"
                              >
                                <X size={12}/>
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                      {(!patrol.members || patrol.members.length === 0) && (
                        <p className="text-xs text-slate-400 text-center py-2">Aucun membre</p>
                      )}
                    </div>
                  </div>

                  {canManage && (
                    <div className="px-4 pb-4">
                      <div className="flex gap-1">
                        {PATROL_STATUSES.filter(s => s.id !== "offline").map(s => (
                          <button
                            key={s.id}
                            onClick={() => updatePatrolStatus(patrol.id, s.id)}
                            className={`flex-1 px-2 py-1.5 text-xs font-medium rounded transition-colors ${
                              patrol.status === s.id ? s.buttonActive : s.buttonInactive
                            }`}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
            {patrols.length === 0 && (
              <div className="md:col-span-2 text-center py-12 text-slate-400 bg-slate-800/50 rounded border border-dashed border-slate-700">
                Aucune patrouille active
                {canManage && (
                  <Button onClick={openCreatePatrol} className="block mx-auto mt-4">
                    Créer une patrouille
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Active Dispatches */}
          {dispatches.filter(d => d.status !== "completed" && d.status !== "cancelled").length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Siren size={16} className="text-red-500"/>
                Appels en cours
              </h3>
              <div className="space-y-2">
                {dispatches.filter(d => d.status !== "completed" && d.status !== "cancelled").map(d => (
                  <Card 
                    key={d.id} 
                    className={
                      d.priority >= 2 ? "border-red-500 bg-red-900/10" :
                      d.priority === 1 ? "border-amber-500 bg-amber-900/10" : ""
                    }
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-white text-sm">{d.call_type}</p>
                        <p className="text-xs text-slate-400">{d.location || "Localisation inconnue"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {d.patrol_name && (
                          <Badge variant="info">{d.patrol_call_sign || d.patrol_name}</Badge>
                        )}
                        <Badge variant={
                          d.status === "pending" ? "warning" :
                          d.status === "dispatched" ? "info" : "success"
                        }>
                          {d.status === "pending" ? "En attente" :
                           d.status === "dispatched" ? "Assigné" :
                           d.status === "en_route" ? "En route" : "Sur place"}
                        </Badge>
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex gap-2 mt-3">
                        {d.status !== "on_scene" && (
                          <Button 
                            size="sm"
                            onClick={() => updateDispatchStatus(d.id, 
                              d.status === "pending" ? "dispatched" : 
                              d.status === "dispatched" ? "en_route" : "on_scene"
                            )}
                          >
                            {d.status === "pending" ? "Assigner" : 
                             d.status === "dispatched" ? "En route" : "Sur place"}
                          </Button>
                        )}
                        <Button variant="success" size="sm" onClick={() => updateDispatchStatus(d.id, "completed")}>
                          Terminé
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => updateDispatchStatus(d.id, "cancelled")}>
                          Annuler
                        </Button>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Notes Journal */}
          <Card noPadding className="overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <MessageSquare size={16} className="text-blue-500"/>
                Journal de bord
              </h3>
            </div>
            <div className="max-h-60 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-700">
              {notes.map(note => (
                <div 
                  key={note.id} 
                  className={`px-4 py-3 ${
                    note.is_pinned ? "bg-amber-50 dark:bg-amber-900/10" :
                    note.note_type === "urgent" ? "bg-red-50 dark:bg-red-900/10" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      note.note_type === "urgent" ? "bg-red-100 text-red-600" :
                      note.note_type === "warning" ? "bg-amber-100 text-amber-600" :
                      "bg-blue-100 text-blue-600"
                    }`}>
                      {note.note_type === "urgent" ? <AlertCircle size={12}/> : <MessageSquare size={12}/>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-800 dark:text-white">{note.content}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                        <span>{note.author_first_name} {note.author_last_name}</span>
                        <span>-</span>
                        <span>{new Date(note.created_at).toLocaleTimeString("fr-FR", {hour: "2-digit", minute: "2-digit"})}</span>
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => togglePinNote(note.id)} className={`p-1 ${note.is_pinned ? "text-amber-500" : "text-slate-400"} hover:text-amber-500`}>
                          <Pin size={12}/>
                        </button>
                        <button onClick={() => deleteNote(note.id)} className="p-1 text-slate-400 hover:text-red-500">
                          <Trash2 size={12}/>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {notes.length === 0 && (
                <div className="px-4 py-8 text-center text-slate-400">Aucune note</div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Modals */}
      {showPatrolModal && (
        <Modal title={editingPatrol ? "Modifier Patrouille" : "Nouvelle Patrouille"} onClose={() => setShowPatrolModal(false)}>
          <form onSubmit={savePatrol} className="space-y-4">
            <InputField label="Nom" value={patrolForm.name} onChange={(e) => setPatrolForm({...patrolForm, name: e.target.value})} required />
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Indicatif" placeholder="ADAM-12" value={patrolForm.call_sign} onChange={(e) => setPatrolForm({...patrolForm, call_sign: e.target.value})} />
              <InputField label="Véhicule" value={patrolForm.vehicle} onChange={(e) => setPatrolForm({...patrolForm, vehicle: e.target.value})} />
            </div>
            <InputField label="Secteur" value={patrolForm.sector} onChange={(e) => setPatrolForm({...patrolForm, sector: e.target.value})} />
            <TextArea label="Notes" value={patrolForm.notes} onChange={(e) => setPatrolForm({...patrolForm, notes: e.target.value})} />
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={() => setShowPatrolModal(false)} className="flex-1">Annuler</Button>
              <Button type="submit" className="flex-1">{editingPatrol ? "Enregistrer" : "Créer"}</Button>
            </div>
          </form>
        </Modal>
      )}

      {showAssignModal && selectedPatrol && (
        <Modal title={"Assigner à " + selectedPatrol.name} onClose={() => setShowAssignModal(false)}>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {availableOfficers.length > 0 ? (
              availableOfficers.map(officer => (
                <button
                  key={officer.id}
                  onClick={() => { assignOfficer(officer.id); setShowAssignModal(false); }}
                  className="w-full flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded bg-slate-200 dark:bg-slate-600 flex items-center justify-center overflow-hidden text-sm font-medium">
                    {officer.profile_picture ? (
                      <img src={officer.profile_picture} className="w-full h-full object-cover" alt="" />
                    ) : (officer.first_name ? officer.first_name[0] : "?")}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-800 dark:text-white text-sm">{officer.first_name} {officer.last_name}</p>
                    <p className="text-xs" style={{color: officer.grade_color}}>{officer.grade_name}</p>
                  </div>
                  <Plus className="text-blue-500" size={16}/>
                </button>
              ))
            ) : (
              <div className="text-center py-8 text-slate-400">Aucun officier disponible</div>
            )}
          </div>
        </Modal>
      )}

      {showNoteModal && (
        <Modal title="Nouvelle Note" onClose={() => setShowNoteModal(false)}>
          <form onSubmit={saveNote} className="space-y-4">
            <TextArea label="Message" value={noteForm.content} onChange={(e) => setNoteForm({...noteForm, content: e.target.value})} required />
            <SelectField label="Type" value={noteForm.note_type} onChange={(e) => setNoteForm({...noteForm, note_type: e.target.value})}>
              <option value="info">Information</option>
              <option value="warning">Attention</option>
              <option value="urgent">Urgent</option>
            </SelectField>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={noteForm.is_pinned} onChange={(e) => setNoteForm({...noteForm, is_pinned: e.target.checked})} className="rounded"/>
              <span className="text-sm text-slate-600 dark:text-slate-300">Épingler cette note</span>
            </label>
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={() => setShowNoteModal(false)} className="flex-1">Annuler</Button>
              <Button type="submit" className="flex-1">Publier</Button>
            </div>
          </form>
        </Modal>
      )}

      {showDispatchModal && (
        <Modal title="Nouvel Appel" onClose={() => setShowDispatchModal(false)}>
          <form onSubmit={saveDispatch} className="space-y-4">
            <SelectField label="Type" value={dispatchForm.call_type} onChange={(e) => {
              const callType = CALL_TYPES.find(c => c.label === e.target.value);
              setDispatchForm({...dispatchForm, call_type: e.target.value, priority: callType ? callType.priority : 0});
            }} required>
              <option value="">Sélectionner...</option>
              {CALL_TYPES.map(c => <option key={c.id} value={c.label}>{c.label}</option>)}
            </SelectField>
            <InputField label="Localisation" value={dispatchForm.location} onChange={(e) => setDispatchForm({...dispatchForm, location: e.target.value})} />
            <TextArea label="Description" value={dispatchForm.description} onChange={(e) => setDispatchForm({...dispatchForm, description: e.target.value})} />
            <SelectField label="Assigner à" value={dispatchForm.patrol_id} onChange={(e) => setDispatchForm({...dispatchForm, patrol_id: e.target.value})}>
              <option value="">-- Non assigné --</option>
              {patrols.filter(p => p.status === "available").map(p => (
                <option key={p.id} value={p.id}>{p.call_sign || p.name}</option>
              ))}
            </SelectField>
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={() => setShowDispatchModal(false)} className="flex-1">Annuler</Button>
              <Button type="submit" className="flex-1">Créer</Button>
            </div>
          </form>
        </Modal>
      )}
    </Layout>
  );
}

export default Centrale;

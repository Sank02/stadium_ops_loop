'use client';

import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Activity, AlertTriangle, CheckCircle, ShieldAlert, Users, Navigation, Accessibility, Truck, Leaf, Clock, XCircle, RotateCcw, Loader2, Bug } from 'lucide-react';
import { Signals } from '@/lib/sense';
import { LogEntry } from '@/lib/remember';
import { ReasoningOutput } from '@/lib/reason';

export default function StadiumOpsDashboard() {
  const [isRunning, setIsRunning] = useState(false);
  const [signals, setSignals] = useState<Signals | null>(null);
  const [recommendation, setRecommendation] = useState<ReasoningOutput | null>(null);
  const [verifyPassed, setVerifyPassed] = useState<boolean>(true);
  const [verifyReason, setVerifyReason] = useState<string | undefined>();
  const [history, setHistory] = useState<LogEntry[]>([]);
  const [lang, setLang] = useState<'en' | 'hi' | 'mr'>('en');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const approveLog = async (tick_id: number) => {
    try {
      await fetch('/api/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tick_id })
      });
      setHistory(prev => prev.map(log => 
        (log.tick_id === tick_id && log.action_taken === 'flagged_for_review') 
          ? { ...log, action_taken: 'approved_by_staff' } 
          : log
      ));
    } catch (err) {
      console.error(err);
    }
  };

  const fetchState = async (forceEvent = false, testInvalidLocation = false) => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/loop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceEvent, testInvalidLocation })
      });
      const data = await res.json();
      
      setSignals(data.signals);
      setRecommendation(data.recommendation);
      setVerifyPassed(data.verifyPassed);
      setVerifyReason(data.verifyReason);
      setHistory(prev => {
        const next = [...prev, data.log];
        if (next.length > 50) return next.slice(-50);
        return next;
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const loadInitialState = async () => {
    try {
      const res = await fetch('/api/loop');
      const data = await res.json();
      setSignals(data.signals);
      setHistory(data.history || []);
    } catch (err) {}
  };

  useEffect(() => {
    loadInitialState();
  }, []);

  useEffect(() => {
    if (isRunning) {
      // Loop every 20 seconds
      timerRef.current = setInterval(() => {
        fetchState();
      }, 20000);
      
      // Fetch immediately on start
      fetchState();
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  const toggleLoop = () => setIsRunning(!isRunning);

  const triggerEvent = () => {
    fetchState(true);
  };

  const triggerInvalidLocationTest = () => {
    if (isRunning) setIsRunning(false);
    fetchState(false, true);
  };

  const resetDemoData = async () => {
    try {
      await fetch('/api/reset', { method: 'POST' });
      loadInitialState();
      setRecommendation(null);
      setVerifyPassed(true);
      setVerifyReason(undefined);
      if (isRunning) setIsRunning(false);
    } catch (err) {
      console.error(err);
    }
  };

  const getCategoryIcon = (cat?: string) => {
    switch(cat) {
      case 'crowd_management': return <Users size={20} />;
      case 'navigation': return <Navigation size={20} />;
      case 'accessibility': return <Accessibility size={20} />;
      case 'transportation': return <Truck size={20} />;
      case 'sustainability': return <Leaf size={20} />;
      case 'safety': return <ShieldAlert size={20} />;
      default: return <Activity size={20} />;
    }
  };

  const getHistoryBadgeStyle = (entry: LogEntry) => {
    if (entry.action_taken === 'flagged_for_review') {
      return 'bg-[var(--color-warning-dim)] text-[var(--color-warning)] border border-[var(--color-warning)]/30';
    }
    if (entry.action_taken === 'approved_by_staff' || entry.reasoning_output?.recommendation?.toLowerCase() === 'no action needed') {
      return 'bg-[var(--color-success-dim)] text-[var(--color-success)] border border-[var(--color-success)]/30';
    }
    return 'bg-blue-500/10 text-blue-400 border border-blue-500/30';
  };

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[var(--color-card)] p-6 rounded-2xl border border-[var(--color-border)] shadow-lg">
        <div>
          <div className="flex items-center gap-3">
            <ShieldAlert className="text-[var(--color-success)]" size={38} />
            <h1 className="text-3xl font-bold leading-none">Stadium Ops Loop</h1>
          </div>
          <p className="text-sm text-gray-400 mt-1 md:ml-12">Autonomous Monitoring & Resolution Engine</p>
        </div>
        
        <div className="flex flex-wrap gap-3 items-center mt-4 md:mt-0 justify-start md:justify-end">
          <button 
            onClick={resetDemoData}
            className="px-4 py-2.5 bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white rounded-lg font-medium transition-colors flex items-center gap-2 border border-gray-600 text-sm h-10"
          >
            <RotateCcw size={18} />
            Reset Demo Data
          </button>

          <button 
            onClick={triggerInvalidLocationTest}
            className="px-4 py-2.5 bg-purple-900/50 text-purple-400 hover:bg-purple-900 hover:text-white rounded-lg font-medium transition-colors flex items-center gap-2 border border-purple-500/50 text-sm h-10"
          >
            <Bug size={18} />
            Test: Invalid Location
          </button>

          <button 
            onClick={triggerEvent}
            className="px-4 py-2.5 bg-[var(--color-warning-dim)] text-[var(--color-warning)] hover:bg-[var(--color-warning)] hover:text-white rounded-lg font-medium transition-colors flex items-center gap-2 border border-[var(--color-warning)] text-sm h-10"
          >
            <AlertTriangle size={18} />
            Trigger Event
          </button>
          
          <button 
            onClick={toggleLoop}
            className={`px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm border h-10 ${isRunning ? 'bg-[var(--color-danger-dim)] text-[var(--color-danger)] border-[var(--color-danger)] hover:bg-[var(--color-danger)] hover:text-white' : 'bg-[var(--color-success-dim)] text-[var(--color-success)] border-[var(--color-success)] hover:bg-[var(--color-success)] hover:text-white'}`}
          >
            {isRunning ? <><Pause size={18} /> Stop Loop</> : <><Play size={18} /> Start Loop</>}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Live Signals */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-[var(--color-card)] p-6 rounded-2xl border border-[var(--color-border)] shadow-lg flex flex-col h-full">
            <h2 className="text-xl font-bold mb-5 flex items-center gap-2">
              <Activity className="text-blue-400" /> Live Signals
            </h2>
            
            {signals ? (
              <div className="space-y-6 flex-1">
                <div>
                  <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Gates</h3>
                  <div className="space-y-3">
                    {signals.gates.map(g => (
                      <div key={g.gate_id} className="bg-gray-800/50 p-3 rounded-lg flex justify-between items-center border border-gray-700/50">
                        <span className="font-medium">{g.gate_id}</span>
                        <div className="text-right flex items-center gap-4">
                          <span className={`text-sm ${g.queue_length > g.capacity * 0.8 ? 'text-[var(--color-danger)]' : 'text-gray-300'}`}>
                            {g.queue_length} pax
                          </span>
                          <span className="text-xs flex items-center gap-1 text-gray-400">
                            <Clock size={12} /> {g.wait_minutes}m
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Concessions</h3>
                  <div className="space-y-3">
                    {signals.concessions.map(c => (
                      <div key={c.stand_id} className="bg-gray-800/50 p-3 rounded-lg flex justify-between items-center border border-gray-700/50">
                        <span className="font-medium">{c.stand_id}</span>
                        <span className="text-sm text-gray-300 flex items-center gap-1">
                          <Clock size={12} /> {c.wait_minutes}m wait
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {signals.incidents.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-[var(--color-danger)] uppercase tracking-wider mb-3 flex items-center gap-2">
                      <AlertTriangle size={16} /> Active Incidents
                    </h3>
                    <div className="space-y-3">
                      {signals.incidents.map(inc => (
                        <div key={inc.id} className="bg-[var(--color-danger-dim)] p-4 rounded-xl border-l-4 border-t border-r border-b border-[var(--color-danger)]/20 border-l-[var(--color-danger)]">
                          <p className="font-bold text-[var(--color-danger)] text-sm">{inc.type.replace('_', ' ').toUpperCase()}</p>
                          <p className="text-sm mt-1 text-gray-200">{inc.description}</p>
                          <p className="text-xs text-gray-400 mt-2">📍 {inc.location}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                No signals data available
              </div>
            )}
            
            {signals && (
              <div className="mt-6 pt-4 border-t border-gray-800 text-xs text-gray-500 flex justify-between">
                <span>Last updated: {new Date(signals.timestamp).toLocaleTimeString()}</span>
                <span>{signals.weather.temp_c}°C {signals.weather.condition}</span>
              </div>
            )}
          </div>
        </div>

        {/* Middle Column: Current Recommendation */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[var(--color-card)] p-6 rounded-2xl border border-[var(--color-border)] shadow-lg min-h-[550px] flex flex-col relative overflow-hidden">
            
            {/* Background Gradient based on status */}
            <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${
              !recommendation ? 'from-gray-600 to-gray-400' :
              recommendation.recommendation.toLowerCase() === 'no action needed' ? 'from-[var(--color-success)] to-emerald-400' :
              !verifyPassed ? 'from-[var(--color-warning)] to-amber-400' :
              'from-blue-500 to-cyan-400'
            }`} />

            <h2 className="text-xl font-bold mb-5">Action Hub</h2>

            {isProcessing ? (
              <div className="flex-1 flex flex-col items-center justify-center text-blue-400">
                <Loader2 className="animate-spin mb-4" size={48} />
                <p className="font-medium animate-pulse">Processing signals & generating recommendation...</p>
              </div>
            ) : !recommendation ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                <RotateCcw className="mb-4 opacity-50" size={48} />
                <p>Start the loop or trigger an event to generate recommendations.</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col gap-6">
                
                {/* Status Banner */}
                <div className={`p-4 rounded-xl border-l-4 border-t border-r border-b flex items-start gap-4 shadow-sm ${
                  !verifyPassed ? 'bg-[var(--color-warning-dim)] border-l-[var(--color-warning)] border-t-[var(--color-warning)]/20 border-r-[var(--color-warning)]/20 border-b-[var(--color-warning)]/20' :
                  recommendation.recommendation.toLowerCase() === 'no action needed' ? 'bg-[var(--color-success-dim)] border-l-[var(--color-success)] border-t-[var(--color-success)]/20 border-r-[var(--color-success)]/20 border-b-[var(--color-success)]/20' :
                  'bg-blue-500/10 border-l-blue-500 border-t-blue-500/20 border-r-blue-500/20 border-b-blue-500/20'
                }`}>
                  <div className="mt-1">
                    {!verifyPassed ? <AlertTriangle className="text-[var(--color-warning)]" /> :
                     recommendation.recommendation.toLowerCase() === 'no action needed' ? <CheckCircle className="text-[var(--color-success)]" /> :
                     <ShieldAlert className="text-blue-400" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h3 className="text-lg font-bold">
                        {recommendation.recommendation}
                      </h3>
                      <span className="px-3 py-1 bg-black/30 rounded-full text-xs font-mono">
                        Conf: {(recommendation.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    
                    {!verifyPassed && (
                      <div className="mt-3 p-3 bg-black/40 rounded-lg text-sm text-[var(--color-warning)] border border-[var(--color-warning)]/30">
                        <p className="font-semibold mb-1 flex items-center gap-1"><XCircle size={14}/> HUMAN REVIEW REQUIRED</p>
                        <p>{verifyReason}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Reasoning */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider">AI Reasoning</h4>
                    <p className="text-gray-300 leading-relaxed bg-gray-800/30 p-4 rounded-xl border border-gray-700/50">
                      {recommendation.reasoning}
                    </p>
                  </div>
                  
                  {/* Details */}
                  <div className="space-y-4 bg-gray-800/30 p-4 rounded-xl border border-gray-700/50">
                    <div>
                      <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Category</h4>
                      <div className="flex items-center gap-2 text-sm">
                        {getCategoryIcon(recommendation.category)}
                        <span className="capitalize">{recommendation.category?.replace('_', ' ')}</span>
                      </div>
                    </div>
                    {recommendation.target_location && (
                      <div>
                        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Target Location</h4>
                        <p className="text-sm font-medium text-blue-300">{recommendation.target_location}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Multilingual Alert Draft */}
                {recommendation.alert_draft && (
                  <div className="mt-auto border border-gray-700 rounded-xl overflow-hidden">
                    <div className="bg-gray-800 p-3 flex justify-between items-center border-b border-gray-700">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <span>📢 Fan Screen Alert</span>
                      </h4>
                      <div className="flex gap-1 bg-black/20 p-1 rounded-lg">
                        {(['en', 'hi', 'mr'] as const).map(l => (
                          <button
                            key={l}
                            onClick={() => setLang(l)}
                            className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${lang === l ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                          >
                            {l.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="p-6 bg-gray-900 flex items-center justify-center min-h-[120px]">
                      <p className="text-2xl font-light text-center">
                        {recommendation.alert_draft[lang]}
                      </p>
                    </div>
                  </div>
                )}
                
              </div>
            )}
          </div>
        </div>
      </div>

      {/* History Log */}
      <div className="bg-[var(--color-card)] p-6 rounded-2xl border border-[var(--color-border)] shadow-lg mt-6">
        <h2 className="text-xl font-bold mb-5 flex items-center gap-2">
          <Clock className="text-gray-400" /> Loop History
        </h2>
        
        {history.length === 0 ? (
          <p className="text-gray-500 text-sm">No history recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-gray-400 uppercase bg-gray-800/50 whitespace-nowrap text-center">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">Tick ID</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3 w-1/2">Recommendation</th>
                  <th className="px-4 py-3">Confidence</th>
                  <th className="px-4 py-3 rounded-tr-lg">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {[...history].filter(entry => entry && entry.tick_id).reverse().slice(0, 10).map((entry, idx) => (
                  <tr key={idx} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-gray-400 whitespace-nowrap text-center align-middle">#{entry.tick_id}</td>
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap text-center align-middle">{new Date(entry.timestamp).toLocaleTimeString()}</td>
                    <td className="px-4 py-3 font-medium whitespace-normal text-left align-middle" title={entry.reasoning_output?.recommendation}>
                      {entry.reasoning_output?.recommendation || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-center align-middle">
                      {entry.reasoning_output?.confidence !== undefined ? 
                        (entry.reasoning_output.confidence * 100).toFixed(0) + '%' : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center align-middle">
                      <span className={`px-2 py-1 rounded-md text-xs font-bold ${getHistoryBadgeStyle(entry)}`}>
                        {entry.action_taken.replace(/_/g, ' ')}
                      </span>
                      {entry.action_taken === 'flagged_for_review' && (
                        <button 
                          onClick={() => approveLog(entry.tick_id)}
                          className="ml-3 text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded transition-colors"
                        >
                          Approve
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
    </div>
  );
}

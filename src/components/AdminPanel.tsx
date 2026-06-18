import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Report, Post, User } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Trash2, Ban, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export function AdminPanel() {
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState({ pending: 0, resolved: 0 });

  useEffect(() => {
    const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Report));
      setReports(docs);
      setStats({
        pending: docs.filter(r => r.status === 'pending').length,
        resolved: docs.filter(r => r.status !== 'pending').length
      });
    }, (error) => {
      console.error("[Nexus] Admin monitor error:", error);
    });
  }, []);

  const handleAction = async (reportId: string, action: 'resolve' | 'dismiss', targetId: string, targetType: string) => {
    try {
      if (action === 'resolve') {
        if (targetType === 'post') {
          await updateDoc(doc(db, 'posts', targetId), { isRemoved: true });
        } else if (targetType === 'user') {
          await updateDoc(doc(db, 'users', targetId), { isBanned: true });
        }
      }
      await updateDoc(doc(db, 'reports', reportId), { status: action === 'resolve' ? 'resolved' : 'dismissed' });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="flex-1 min-h-screen bg-black border-r border-white/5">
      <header className="h-14 border-b border-white/10 px-6 flex items-center justify-between glass sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Shield className="text-red-500" size={20} />
          <span className="text-sm font-bold tracking-tight uppercase font-mono">Cluster Moderation Console</span>
        </div>
        <div className="flex gap-4">
          <StatBadge label="Pending" count={stats.pending} color="red" />
          <StatBadge label="Resolved" count={stats.resolved} color="green" />
        </div>
      </header>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 gap-4">
          <AnimatePresence>
            {reports.map((report) => (
              <motion.div 
                layout
                key={report.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className={`glass p-5 rounded-2xl border-white/5 flex flex-col gap-4 ${report.status !== 'pending' ? 'opacity-50 grayscale' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-500">
                      <AlertTriangle size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono">
                        INCIDENT_ID: {report.id.slice(0, 8)} // {report.targetType}
                      </p>
                      <h4 className="font-bold text-white text-lg">{report.reason}</h4>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-zinc-500 font-mono">TIMESTAMP</p>
                    <p className="text-xs text-white">{formatDistanceToNow(new Date(report.createdAt?.toDate?.() || report.createdAt), { addSuffix: true })}</p>
                  </div>
                </div>

                <div className="bg-zinc-950/50 p-4 rounded-xl border border-white/5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold text-blue-500 font-mono">REPORTER_LOG:</span>
                    <span className="text-xs text-zinc-400">UID_{report.reporterId.slice(0, 8)}</span>
                  </div>
                  <p className="text-sm text-zinc-300 italic">"{report.details || "No technical details provided."}"</p>
                </div>

                {report.status === 'pending' && (
                  <div className="flex items-center justify-end gap-3 mt-2">
                    <button 
                      onClick={() => handleAction(report.id, 'dismiss', report.targetId, report.targetType)}
                      className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-white transition-colors px-4 py-2 border border-white/5 rounded-full hover:bg-white/5"
                    >
                      <XCircle size={14} />
                      Dismiss Packet
                    </button>
                    <button 
                      onClick={() => handleAction(report.id, 'resolve', report.targetId, report.targetType)}
                      className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-red-500 hover:text-red-400 transition-colors px-4 py-2 border border-red-500/20 rounded-full hover:bg-red-500/10"
                    >
                      <Trash2 size={14} />
                      Purge Entity ({report.targetType})
                    </button>
                  </div>
                )}
                {report.status !== 'pending' && (
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-600 font-mono">
                     <CheckCircle size={14} />
                     State Transition: RESOLVED
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function StatBadge({ label, count, color }: any) {
  const colors: any = {
    red: "bg-red-500/10 text-red-500 border-red-500/20",
    green: "bg-green-500/10 text-green-500 border-green-500/20",
  };
  return (
    <div className={`flex items-center gap-3 px-3 py-1 rounded-lg border ${colors[color]} text-[10px] font-bold uppercase tracking-widest`}>
      <span>{label}</span>
      <span className="font-mono text-xs">{count}</span>
    </div>
  );
}

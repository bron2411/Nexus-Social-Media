import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, X, Bell, Moon, Sun, Save, CheckCircle } from 'lucide-react';
import { useNexusStore } from '../store';
import { updateNotificationSettings } from '../services/firebaseService';
import { auth } from '../firebase';

interface NotificationSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationSettings({ isOpen, onClose }: NotificationSettingsProps) {
  const { user } = useNexusStore();
  const [settings, setSettings] = useState({
    likes: true,
    comments: true,
    mentions: true,
    messages: true
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (user?.notificationSettings) {
      setSettings(user.notificationSettings);
    }
  }, [user]);

  const handleToggle = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    if (!auth.currentUser) return;
    setIsSaving(true);
    try {
      await updateNotificationSettings(settings);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-md glass border border-white/10 rounded-2xl shadow-2xl overflow-hidden relative z-10"
          >
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
              <div className="flex items-center gap-2">
                <Settings size={20} className="text-blue-500" />
                <span className="font-bold text-sm tracking-tight uppercase font-mono">Instance Preferences</span>
              </div>
              <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-8">
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Bell size={16} className="text-zinc-500" />
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest font-mono">Notification Packets</p>
                </div>
                
                <ToggleItem 
                  label="Incoming Likes" 
                  description="Receive alert when your packets are marked as preferred." 
                  enabled={settings.likes} 
                  onToggle={() => handleToggle('likes')} 
                />
                <ToggleItem 
                  label="New Comments" 
                  description="Alert on node replies to your content." 
                  enabled={settings.comments} 
                  onToggle={() => handleToggle('comments')} 
                />
                <ToggleItem 
                  label="Cluster Mentions" 
                  description="Notifications when your @handle is tagged in a stream." 
                  enabled={settings.mentions} 
                  onToggle={() => handleToggle('mentions')} 
                />
                <ToggleItem 
                  label="Direct Messages" 
                  description="Real-time alerts for incoming private buffers." 
                  enabled={settings.messages} 
                  onToggle={() => handleToggle('messages')} 
                />
              </div>

              <div className="pt-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {showSuccess && (
                     <motion.div 
                      initial={{ opacity: 0, x: -10 }} 
                      animate={{ opacity: 1, x: 0 }} 
                      className="flex items-center gap-1.5 text-blue-500 text-[10px] font-bold font-mono tracking-tight"
                     >
                       <CheckCircle size={12} />
                       SYNC_COMPLETE
                     </motion.div>
                  )}
                </div>
                <button 
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-6 py-2 rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? "Syncing..." : "Update Preferences"}
                  <Save size={14} />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function ToggleItem({ label, description, enabled, onToggle }: any) {
  return (
    <div className="flex items-start justify-between gap-4 group">
      <div>
        <h4 className="text-sm font-bold text-white mb-0.5">{label}</h4>
        <p className="text-[11px] text-zinc-500 leading-tight">{description}</p>
      </div>
      <button 
        onClick={onToggle}
        className={`w-10 h-5 rounded-full relative transition-colors duration-200 shrink-0 mt-1 ${enabled ? 'bg-blue-600' : 'bg-zinc-800'}`}
      >
        <motion.div 
          animate={{ x: enabled ? 22 : 4 }}
          className="absolute top-1 left-0 w-3 h-3 bg-white rounded-full shadow-sm"
        />
      </button>
    </div>
  );
}

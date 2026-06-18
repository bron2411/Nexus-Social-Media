import { 
  Home, 
  Search, 
  Bell, 
  Mail, 
  User as UserIcon, 
  MoreHorizontal,
  PlusCircle,
  Hash,
  LogOut,
  ShieldAlert
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useNexusStore } from '../store';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

interface SidebarProps {
  onSearchOpen: () => void;
  onAdminClick: () => void;
  activeView: string;
  onViewChange: (view: string) => void;
  unreadNotificationsCount?: number;
}

export function Sidebar({ onSearchOpen, onAdminClick, activeView, onViewChange, unreadNotificationsCount = 0 }: SidebarProps) {
  const { user } = useNexusStore();
  
  const menuItems = [
    { icon: Home, label: 'Inicio', view: 'feed' },
    { icon: Search, label: 'Buscar', action: onSearchOpen },
    { icon: Bell, label: 'Notificaciones', view: 'notifications', badge: unreadNotificationsCount },
    { icon: Mail, label: 'Mensajes', view: 'messages' },
    { icon: UserIcon, label: 'Perfil', view: 'profile' },
  ];

  const handleLogout = () => signOut(auth);

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 glass p-4 flex flex-col hidden lg:flex border-none z-10">
      <div className="mb-8 px-3 flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white cursor-pointer" onClick={() => onViewChange('feed')}>N</div>
        <h1 className="text-lg font-bold tracking-tight text-white">Nexus</h1>
      </div>
      
      <nav className="flex-1 flex flex-col gap-1">
        {menuItems.map((item) => (
          <button
            key={item.label}
            onClick={() => item.action ? item.action() : onViewChange(item.view!)}
            className={cn(
              "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-all relative group",
              activeView === item.view ? "text-white bg-white/5 font-medium" : "text-white/50 hover:text-white hover:bg-white/5"
            )}
          >
            <item.icon size={18} />
            <span className="flex-1 text-left">{item.label}</span>
            {item.badge !== undefined && item.badge > 0 && (
              <span className="bg-blue-600 text-white font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center animate-bounce">
                {item.badge}
              </span>
            )}
          </button>
        ))}

        {user?.isAdmin && (
          <button
            onClick={onAdminClick}
            className={cn(
              "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-all mt-4 border border-red-500/10",
              activeView === 'admin' ? "text-red-500 bg-red-500/5 font-medium" : "text-red-500/50 hover:text-red-500 hover:bg-red-500/5"
            )}
          >
            <ShieldAlert size={18} />
            <span>Moderación</span>
          </button>
        )}
      </nav>

      <div className="mt-auto pt-4 border-t border-white/5">
        <div className="flex items-center gap-3 px-2">
          {user ? (
            <>
              <img src={user.photoURL} alt={user.displayName} className="h-8 w-8 rounded-full border border-white/10" />
              <div className="flex-1 overflow-hidden">
                <p className="font-bold text-white truncate text-xs">{user.displayName}</p>
                <p className="text-zinc-500 text-[10px] truncate">@{user.username}</p>
              </div>
              <button onClick={handleLogout} className="text-zinc-500 hover:text-red-500" title="Cerrar sesión">
                <LogOut size={16} />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-3 opacity-50">
              <div className="h-8 w-8 rounded-full bg-zinc-800" />
              <div className="flex-1">
                <p className="font-bold text-white text-xs whitespace-nowrap">Modo Invitado</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}


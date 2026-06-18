import { create } from 'zustand';
import { User, Post } from './types';

interface NexusState {
  user: User | null;
  posts: Post[];
  usersMap: Record<string, any>;
  isChatOpen: boolean;
  activeChatId: string | null;
  viewedUserId: string | null;
  activeView: 'feed' | 'admin' | 'profile' | 'notifications' | 'messages' | 'public-profile';
  searchQuery: string;
  isAuthModalOpen: boolean;
  setUser: (user: User | null) => void;
  setPosts: (posts: Post[]) => void;
  setUsersMap: (map: Record<string, any>) => void;
  toggleChat: () => void;
  setActiveChatId: (id: string | null) => void;
  setViewedUserId: (id: string | null) => void;
  setActiveView: (view: 'feed' | 'admin' | 'profile' | 'notifications' | 'messages' | 'public-profile') => void;
  setSearchQuery: (query: string) => void;
  setAuthModalOpen: (isOpen: boolean) => void;
}

export const useNexusStore = create<NexusState>((set) => ({
  user: null, 
  posts: [],
  usersMap: {},
  isChatOpen: false,
  activeChatId: null,
  viewedUserId: null,
  activeView: 'feed',
  searchQuery: '',
  isAuthModalOpen: false,
  setUser: (user) => set({ user }),
  setPosts: (posts) => set({ posts }),
  setUsersMap: (usersMap) => set({ usersMap }),
  toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),
  setActiveChatId: (id) => set({ activeChatId: id }),
  setViewedUserId: (id) => set({ viewedUserId: id }),
  setActiveView: (view) => set({ activeView: view }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setAuthModalOpen: (isAuthModalOpen) => set({ isAuthModalOpen }),
}));

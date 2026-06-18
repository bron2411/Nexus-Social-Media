export interface User {
  uid: string;
  username: string;
  displayName: string;
  photoURL?: string;
  bannerURL?: string;
  bio?: string;
  followersCount: number;
  followingCount: number;
  createdAt: any;
  isAdmin?: boolean;
  isBanned?: boolean;
  fcmToken?: string;
  isOnline?: boolean;
  lastSeen?: any;
  notificationSettings?: {
    likes: boolean;
    comments: boolean;
    mentions: boolean;
    messages: boolean;
  };
}

export interface Post {
  id: string;
  authorId: string;
  authorUsername?: string;
  authorPhoto?: string;
  content: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  likesCount: number;
  retweetsCount: number;
  commentsCount: number;
  likedBy?: string[];
  retweetedBy?: string[];
  createdAt: any;
  isRemoved?: boolean;
  hashtags?: string[];
  isRepost?: boolean;
  repostedFromId?: string;
  repostedFromUsername?: string;
  originalPostId?: string;
}

export interface Report {
  id: string;
  targetId: string;
  targetType: 'post' | 'user' | 'comment';
  reporterId: string;
  reason: string;
  details?: string;
  status: 'pending' | 'resolved' | 'dismissed';
  createdAt: any;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  createdAt: any;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

import React, { useState, useEffect, useRef } from 'react';
import {
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  Check,
  Camera,
  Upload,
  ArrowLeft,
  Mic,
  Headphones,
  Settings,
  Search,
  LogOut,
  User,
  Plus,
  Compass,
  ArrowUpDown,
  X,
  ZoomIn,
  ZoomOut,
  Trash2,
  Send,
  Smile,
  Hash,
  Users,
  Loader2,
  Reply,
  Image as ImageIcon,
  ExternalLink,
  MessageSquare,
  UserPlus,
  UserCheck,
  Pin,
  PinOff,
  MoreHorizontal,
  Crown,
  Shield,
  Sliders,
  AlertTriangle
} from 'lucide-react';
import { uploadToCloudinary } from './lib/cloudinary';
import {
  UserProfile,
  ChatMessage,
  UserStatus,
  FriendItem,
  checkHandleOrEmailExists,
  findUserByHandleOrEmail,
  saveUserProfile,
  updateUserProfile,
  subscribeToAllUsers,
  subscribeToChannelMessages,
  sendChannelMessage,
  subscribeToSelfMessages,
  sendSelfMessage,
  deleteSelfMessage,
  deleteChannelMessage,
  getDmChatId,
  subscribeToDmMessages,
  sendDmMessage,
  deleteDmMessage,
  toggleMessageReaction,
  addFriend,
  removeFriend,
  acceptFriendRequest,
  declineFriendRequest,
  subscribeToFriends,
  togglePinDm,
  clearUserDmChat,
  setClosedDm,
  TypingUser,
  setTypingStatus,
  subscribeToTyping,
  isMessagePingForUser
} from './lib/database';
import {
  ServerSettingsData,
  ServerRole,
  DEFAULT_SERVER_SETTINGS,
  subscribeToServerSettings,
  checkUserPermissions
} from './lib/serverSettings';
import { ChatMessageItem } from './components/ChatMessageItem';
import { FriendsView } from './components/FriendsView';
import { EmojiPicker } from './components/EmojiPicker';
import { TypingIndicator } from './components/TypingIndicator';
import { MentionAutocomplete, MentionCandidate } from './components/MentionAutocomplete';
import { ServerSettingsModal } from './components/ServerSettingsModal';

type Screen = 'auth' | 'step1' | 'step2' | 'loading' | 'app';
type AuthMode = 'login' | 'register';

const STATUS_CONFIG: Record<UserStatus, { label: string; color: string; bgClass: string }> = {
  online: { label: 'Online', color: '#23a55a', bgClass: 'bg-[#23a55a]' },
  idle: { label: 'Idle', color: '#f0b232', bgClass: 'bg-[#f0b232]' },
  dnd: { label: 'Do Not Disturb', color: '#f23f43', bgClass: 'bg-[#f23f43]' },
  offline: { label: 'Invisible', color: '#80848e', bgClass: 'bg-[#80848e]' }
};

interface ServerChannel {
  id: string;
  name: string;
  description: string;
  category: string;
}

const YAPZO_HQ_CHANNELS: ServerChannel[] = [
  { id: 'welcome', name: 'welcome', description: 'Welcome to Yapzo HQ! Say hello here.', category: 'Information' },
  { id: 'announcements', name: 'announcements', description: 'Official announcements and updates from Yapzo.', category: 'Information' },
  { id: 'rules', name: 'rules', description: 'Server guidelines and rules for Yapzo HQ.', category: 'Information' },
  { id: 'general', name: 'general', description: 'General discussion for all yappers.', category: 'Text Channels' },
  { id: 'yap-session', name: 'yap-session', description: 'Unlimited yapping, deep talks, and thoughts.', category: 'Text Channels' },
  { id: 'media', name: 'media', description: 'Share your clips, screenshots, memes, and artwork.', category: 'Text Channels' },
  { id: 'bot-commands', name: 'bot-commands', description: 'Bot interactions and system commands.', category: 'Text Channels' },
  { id: 'off-topic', name: 'off-topic', description: 'Casual conversation and random thoughts.', category: 'Text Channels' }
];

interface StoredSession {
  isLoggedIn: boolean;
  email: string;
  displayName: string;
  username: string;
  pronouns?: string;
  aboutMe?: string;
  avatar: string | null;
  banner: string | null;
  status: UserStatus;
  isMuted: boolean;
  isDeafened: boolean;
  dmTab: 'dms' | 'friends';
  sortOrder: 'newest' | 'oldest';
  selfMessages?: ChatMessage[];
  activeServerId?: string | null;
  activeChannelId?: string;
  channelMessages?: Record<string, ChatMessage[]>;
}

const STORAGE_KEY = 'yapzo_user_session';

const getStoredSession = (): StoredSession | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return null;
};

const formatDiscordTimestamp = (date = new Date()): string => {
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `Today at ${displayHours}:${minutes} ${ampm}`;
};

// Classic Discord-style tips for the loading screen
const DISCORD_TIPS = [
  'You can press Ctrl + K to quickly search servers, channels, and direct messages.',
  'Holding Shift while clicking the delete button bypasses the delete confirmation.',
  'You can mute a server or channel by right-clicking its icon.',
  'You can drag and drop servers on top of each other to organize them into folders.',
  'Yapzo was founded on long conversations that lasted until 4 AM.',
  'Pressing Esc will mark all unread messages in the active channel as read.',
  'You can press Ctrl + / to see all keyboard shortcuts at any time.',
  'Typing /tableflip puts (╯°□°)╯︵ ┻━┻ into your message.',
  'You can pin up to 50 messages per channel for quick reference.',
  'Share your screen with friends in 60 FPS crystal clear audio on voice channels.',
  'Pressing Tab while writing a message allows you to autocomplete usernames and emojis.'
];

// MODAL FOR RESIZING AVATAR / BANNER (Rotate feature removed)
interface ImageCropModalProps {
  imageSrc: string;
  isAvatar: boolean;
  onCancel: () => void;
  onApply: (dataUrl: string) => Promise<void> | void;
  isUploading?: boolean;
}

function ImageCropModal({ imageSrc, isAvatar, onCancel, onApply, isUploading }: ImageCropModalProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const initialPan = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    initialPan.current = { ...pan };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPan({
      x: initialPan.current.x + dx,
      y: initialPan.current.y + dy
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleConfirm = () => {
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const targetWidth = isAvatar ? 400 : 800;
      const targetHeight = isAvatar ? 400 : 260;
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Fill dark background for transparent areas
      ctx.fillStyle = '#111214';
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      ctx.save();
      ctx.translate(targetWidth / 2, targetHeight / 2);
      ctx.scale(zoom, zoom);

      // Scale base image to fit target bounds proportionally
      const scaleBase = Math.max(targetWidth / img.naturalWidth, targetHeight / img.naturalHeight);
      const drawWidth = img.naturalWidth * scaleBase;
      const drawHeight = img.naturalHeight * scaleBase;

      // Draw transformed image with pan offset
      ctx.drawImage(
        img,
        -drawWidth / 2 + pan.x * (targetWidth / 260),
        -drawHeight / 2 + pan.y * (targetHeight / 260),
        drawWidth,
        drawHeight
      );
      ctx.restore();

      const result = canvas.toDataURL('image/png');
      onApply(result);
    };
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 animate-in fade-in duration-150 select-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <div className="w-full max-w-[500px] bg-[#18191c] border border-[#232428] rounded-[6px] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#232428] flex items-center justify-between">
          <h3 className="text-white font-bold text-[17px]">
            {isAvatar ? 'Edit Avatar' : 'Edit Banner'}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="text-[#949ba4] hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport canvas for dragging and zooming */}
        <div className="p-6 flex flex-col items-center bg-[#111214] relative overflow-hidden">
          <p className="text-[12px] text-[#949ba4] mb-3">
            Click and drag to reposition image within the frame
          </p>

          <div
            onMouseDown={handleMouseDown}
            className={`relative flex items-center justify-center bg-[#0a0a0c] cursor-grab active:cursor-grabbing overflow-hidden ${
              isAvatar
                ? 'w-60 h-60 rounded-full border-2 border-[#ff6b00] ring-8 ring-black/70'
                : 'w-[360px] h-32 rounded-md border-2 border-[#ff6b00] ring-8 ring-black/70'
            }`}
          >
            <img
              src={imageSrc}
              alt="Crop target"
              draggable={false}
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transition: isDragging ? 'none' : 'transform 0.1s ease-out'
              }}
              className="max-w-none w-full h-full object-cover select-none pointer-events-none"
            />
          </div>
        </div>

        {/* Controls: Zoom slider only (Rotate removed) */}
        <div className="p-5 bg-[#18191c] border-t border-[#232428]">
          <div className="flex items-center justify-between text-[13px] font-medium text-[#dbdee1] mb-1.5">
            <span className="flex items-center gap-1.5">
              <ZoomIn className="w-4 h-4 text-[#ff6b00]" /> Zoom / Resize
            </span>
            <span className="text-[#949ba4]">{Math.round(zoom * 100)}%</span>
          </div>
          <div className="flex items-center gap-3">
            <ZoomOut className="w-4 h-4 text-[#949ba4]" />
            <input
              type="range"
              min="0.6"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-[#111214] rounded-lg appearance-none cursor-pointer accent-[#ff6b00]"
            />
            <ZoomIn className="w-4 h-4 text-[#949ba4]" />
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-5 py-3.5 bg-[#141517] border-t border-[#232428] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="text-[14px] text-[#dbdee1] hover:underline cursor-pointer px-3 py-1.5"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isUploading}
            onClick={handleConfirm}
            className="h-9 px-6 bg-[#ff6b00] hover:bg-[#e55b00] active:bg-[#cc4e00] disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium text-[14px] rounded-[3px] transition-colors cursor-pointer flex items-center gap-2"
          >
            {isUploading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isUploading ? 'Uploading image...' : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const initialSession = getStoredSession();

  const [screen, setScreen] = useState<Screen>(initialSession?.isLoggedIn ? 'app' : 'auth');
  const [mode, setMode] = useState<AuthMode>('login');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginErrors, setLoginErrors] = useState<{ email?: string; password?: string }>({});
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);

  // Register form state
  const [regEmail, setRegEmail] = useState(initialSession?.email || '');
  const [regDisplayName, setRegDisplayName] = useState(initialSession?.displayName || '');
  const [regUsername, setRegUsername] = useState(initialSession?.username || '');
  const [pronouns, setPronouns] = useState(initialSession?.pronouns || '');
  const [aboutMe, setAboutMe] = useState(initialSession?.aboutMe || '');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [subscribeNewsletter, setSubscribeNewsletter] = useState(false);
  const [regErrors, setRegErrors] = useState<{
    email?: string;
    username?: string;
    password?: string;
    dob?: string;
  }>({});

  // Step 1: PFP and Banner
  const [avatarPreview, setAvatarPreview] = useState<string | null>(initialSession?.avatar || null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(initialSession?.banner || null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const settingsAvatarInputRef = useRef<HTMLInputElement>(null);
  const settingsBannerInputRef = useRef<HTMLInputElement>(null);

  // Settings profile draft state (for unsaved changes bar)
  const [draftDisplayName, setDraftDisplayName] = useState(initialSession?.displayName || '');
  const [draftPronouns, setDraftPronouns] = useState(initialSession?.pronouns || '');
  const [draftAboutMe, setDraftAboutMe] = useState(initialSession?.aboutMe || '');
  const [draftAvatar, setDraftAvatar] = useState<string | null>(initialSession?.avatar || null);
  const [draftBanner, setDraftBanner] = useState<string | null>(initialSession?.banner || null);

  // Firestore & Cloudinary async states
  const [isCheckingAccount, setIsCheckingAccount] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);

  // Image crop modal state
  const [cropModal, setCropModal] = useState<{
    isOpen: boolean;
    imageSrc: string;
    isAvatar: boolean;
  } | null>(null);

  // Step 2: Terms of Service agreements
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeGuidelines, setAgreeGuidelines] = useState(false);
  const [agreeRules, setAgreeRules] = useState(false);

  // App Layout State (Everyone automatically joins Yapzo HQ)
  const [activeServerId, setActiveServerId] = useState<string | null>(
    initialSession ? (initialSession.activeServerId ?? 'yapzo-hq') : 'yapzo-hq'
  );
  const [isHomeSelected, setIsHomeSelected] = useState<boolean>(
    initialSession ? initialSession.activeServerId === null : false
  );
  const [activeChannelId, setActiveChannelId] = useState<string>(
    initialSession?.activeChannelId || 'welcome'
  );
  const [channelMessages, setChannelMessages] = useState<Record<string, ChatMessage[]>>(
    initialSession?.channelMessages || { welcome: [] }
  );
  const [channelChatInput, setChannelChatInput] = useState('');
  const [showPlayerList, setShowPlayerList] = useState(true);
  const channelMessagesEndRef = useRef<HTMLDivElement>(null);

  const [showServerMenu, setShowServerMenu] = useState(false);
  const [showUserSettings, setShowUserSettings] = useState(false);
  const [activeSubMenu, setActiveSubMenu] = useState<'status' | null>(null);

  // Server Settings & AutoMod state
  const [serverSettings, setServerSettings] = useState<ServerSettingsData>(DEFAULT_SERVER_SETTINGS);
  const [isServerSettingsOpen, setIsServerSettingsOpen] = useState(false);
  const [showServerDropdown, setShowServerDropdown] = useState(false);
  const serverDropdownRef = useRef<HTMLDivElement>(null);

  // DMs / Friends header tab and sort filter state
  const [dmTab, setDmTab] = useState<'dms' | 'friends'>(initialSession?.dmTab || 'dms');
  const [friendsFilterTab, setFriendsFilterTab] = useState<'online' | 'all' | 'pending' | 'add'>('online');
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [addFriendInput, setAddFriendInput] = useState('');
  const [addFriendStatus, setAddFriendStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [friendsSearchQuery, setFriendsSearchQuery] = useState('');

  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>(initialSession?.sortOrder || 'newest');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  // DM state & chat messages (either 'self' or friend's username)
  const [selectedDm, setSelectedDm] = useState<'self' | string>('self');
  const [selfMessages, setSelfMessages] = useState<ChatMessage[]>(initialSession?.selfMessages || []);
  const [dmChatMessages, setDmChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dmChatMessagesEndRef = useRef<HTMLDivElement>(null);
  const channelInputRef = useRef<HTMLInputElement>(null);
  const dmInputRef = useRef<HTMLInputElement>(null);

  // Real-time typing indicators state
  const [channelTypingUsers, setChannelTypingUsers] = useState<TypingUser[]>([]);
  const [dmTypingUsers, setDmTypingUsers] = useState<TypingUser[]>([]);
  const channelTypingTimeoutRef = useRef<any>(null);
  const dmTypingTimeoutRef = useRef<any>(null);
  const isChannelTypingRef = useRef(false);
  const isDmTypingRef = useRef(false);

  // Mention autocomplete popup state
  const [mentionState, setMentionState] = useState<{
    isOpen: boolean;
    query: string;
    cursorIndex: number;
    target: 'channel' | 'dm';
    candidates: MentionCandidate[];
    selectedIndex: number;
  } | null>(null);

  // Replying state (inline Discord quote)
  const [replyTarget, setReplyTarget] = useState<{
    message: ChatMessage;
    location: 'channel' | 'dm' | 'self';
  } | null>(null);

  // Image Attachment state & file input refs (no mp4 supported)
  const [channelAttachment, setChannelAttachment] = useState<{ file: File; previewUrl: string; name: string } | null>(null);
  const [dmAttachment, setDmAttachment] = useState<{ file: File; previewUrl: string; name: string } | null>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [showChannelEmojiPicker, setShowChannelEmojiPicker] = useState(false);
  const [showDmEmojiPicker, setShowDmEmojiPicker] = useState(false);
  const channelFileInputRef = useRef<HTMLInputElement>(null);
  const dmFileInputRef = useRef<HTMLInputElement>(null);

  // Fullscreen Image & GIF Lightbox viewer modal
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Profile sidebar overlapping DM
  const [showProfilePanel, setShowProfilePanel] = useState(true);

  // User audio & status state
  const [isMuted, setIsMuted] = useState(initialSession?.isMuted ?? false);
  const [isDeafened, setIsDeafened] = useState(initialSession?.isDeafened ?? false);
  const [userStatus, setUserStatus] = useState<UserStatus>(initialSession?.status || 'online');

  const currentDisplayName =
    regDisplayName.trim() || regUsername.trim() || (loginEmail ? loginEmail.split('@')[0] : 'juxtopposed');
  const currentUsername =
    regUsername.trim() || (loginEmail ? loginEmail.split('@')[0].toLowerCase() : 'juxtopposed');

  // Channel Unread Pings State (channelId -> unread mention count)
  const [channelUnreadPings, setChannelUnreadPings] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(`yapzo_unread_pings_${currentUsername}`);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const activeChannelIdRef = useRef(activeChannelId);
  activeChannelIdRef.current = activeChannelId;
  const activeServerIdRef = useRef(activeServerId);
  activeServerIdRef.current = activeServerId;
  const isHomeSelectedRef = useRef(isHomeSelected);
  isHomeSelectedRef.current = isHomeSelected;
  const userStatusRef = useRef<UserStatus>(userStatus);
  userStatusRef.current = userStatus;
  const currentUsernameRef = useRef(currentUsername);
  currentUsernameRef.current = currentUsername;
  const currentDisplayNameRef = useRef(currentDisplayName);
  currentDisplayNameRef.current = currentDisplayName;
  const lastAudioPlayTimeRef = useRef<number>(0);
  const initialSyncCompleteRef = useRef<Record<string, boolean>>({});
  const seenMessageIdsRef = useRef<Set<string>>(new Set());

  // Total server mentions count across all channels
  const totalServerPings = Object.values(channelUnreadPings).reduce((sum, count) => sum + count, 0);

  // Server permissions check for current user (Owner & Manage Server)
  const isServerOwner =
    (regEmail || loginEmail || '').trim().toLowerCase() === (serverSettings.ownerEmail || 'hayden@gmail.com').trim().toLowerCase() ||
    currentUsername.toLowerCase() === 'hayden';

  const currentUserPerms = checkUserPermissions(
    regEmail || loginEmail || '',
    currentUsername,
    serverSettings
  );

  const canManageServer = isServerOwner || currentUserPerms.canManageServer || currentUserPerms.isAdmin;

  // Play notification sound helper:
  // "when u get a notifcation the sound notifcation.mp3 will play now when ur on dnd u do not get no notification sound it just shows the amount of timesu was pinged."
  const playPingSound = () => {
    if (userStatusRef.current === 'dnd') {
      return;
    }
    const now = Date.now();
    if (now - lastAudioPlayTimeRef.current < 250) {
      return;
    }
    lastAudioPlayTimeRef.current = now;

    try {
      const audio = new Audio('/notification.mp3');
      audio.volume = 0.85;
      audio.play().catch((err) => {
        console.warn('Audio play prevented or unavailable:', err);
      });
    } catch (err) {
      console.warn('Audio error:', err);
    }
  };

  // Browser tab title management:
  // "the tab will change to either 1-99+ depending on how nmany notifs u have in brackets so Yapzo (1)"
  useEffect(() => {
    if (totalServerPings <= 0) {
      document.title = 'Yapzo';
    } else if (totalServerPings > 99) {
      document.title = 'Yapzo (99+)';
    } else {
      document.title = `Yapzo (${totalServerPings})`;
    }

    return () => {
      document.title = 'Yapzo';
    };
  }, [totalServerPings]);

  // Persist unread pings to localStorage
  useEffect(() => {
    if (currentUsername) {
      try {
        localStorage.setItem(`yapzo_unread_pings_${currentUsername}`, JSON.stringify(channelUnreadPings));
      } catch {}
    }
  }, [channelUnreadPings, currentUsername]);

  // Clear unread pings when active channel is viewed
  useEffect(() => {
    if (!isHomeSelected && activeServerId === 'yapzo-hq' && activeChannelId) {
      setChannelUnreadPings((prev) => {
        if (!prev[activeChannelId]) return prev;
        const next = { ...prev };
        delete next[activeChannelId];
        try {
          localStorage.setItem(`yapzo_unread_pings_${currentUsername}`, JSON.stringify(next));
        } catch {}
        return next;
      });
    }
  }, [isHomeSelected, activeServerId, activeChannelId, currentUsername]);

  const selectedFriend = friends.find((f) => f.username.toLowerCase() === selectedDm.toLowerCase()) || null;

  // DM Right-click Context Menu State
  const [dmContextMenu, setDmContextMenu] = useState<{
    x: number;
    y: number;
    targetDm: string;
    targetDisplayName: string;
    targetAvatar: string | null;
  } | null>(null);

  // Local state for pinned, cleared, and closed DMs
  const [localPinnedDms, setLocalPinnedDms] = useState<Record<string, boolean>>({});
  const [localClearedDms, setLocalClearedDms] = useState<Record<string, number>>({});
  const [localClosedDms, setLocalClosedDms] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(`yapzo_closed_dms_${currentUsername}`);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  // State for server member centered profile modal
  const [selectedServerMember, setSelectedServerMember] = useState<UserProfile | null>(null);
  const [showMemberMoreMenu, setShowMemberMoreMenu] = useState(false);
  const [memberModalFeedback, setMemberModalFeedback] = useState<string | null>(null);

  // Sync user's pinned, cleared, and closed DMs from allUsers profile
  const loggedInUserProfile = allUsers.find(
    (u) => u.username.toLowerCase() === currentUsername.toLowerCase()
  );

  useEffect(() => {
    if (loggedInUserProfile) {
      if (loggedInUserProfile.pinnedDms) {
        setLocalPinnedDms(loggedInUserProfile.pinnedDms);
      }
      if (loggedInUserProfile.clearedDms) {
        setLocalClearedDms(loggedInUserProfile.clearedDms);
      }
      if (loggedInUserProfile.closedDms) {
        setLocalClosedDms((prev) => ({ ...loggedInUserProfile.closedDms, ...prev }));
      }
    }
  }, [loggedInUserProfile]);

  const handleTogglePinDm = async (targetDm: string) => {
    const key = targetDm.toLowerCase();
    const isCurrentlyPinned = !!localPinnedDms[key];
    const willBePinned = !isCurrentlyPinned;

    setLocalPinnedDms((prev) => {
      const next = { ...prev };
      if (willBePinned) next[key] = true;
      else delete next[key];
      return next;
    });

    try {
      await togglePinDm(currentUsername, key, willBePinned);
    } catch (err) {
      console.error('Error toggling pin DM:', err);
    }
    setDmContextMenu(null);
  };

  const handleClearDmChat = async (targetDm: string) => {
    const key = targetDm.toLowerCase();
    const now = Date.now();

    setLocalClearedDms((prev) => ({
      ...prev,
      [key]: now
    }));

    try {
      await clearUserDmChat(currentUsername, key);
    } catch (err) {
      console.error('Error clearing DM chat:', err);
    }
    setDmContextMenu(null);
  };

  // Delete DM: wipes all messages for the current user and removes DM from list
  const handleDeleteDm = async (targetDm: string) => {
    const key = targetDm.toLowerCase();
    const now = Date.now();

    // 1. Wipe all messages for this user in this DM
    setLocalClearedDms((prev) => ({
      ...prev,
      [key]: now
    }));
    try {
      await clearUserDmChat(currentUsername, key);
    } catch (err) {
      console.error('Error clearing DM chat:', err);
    }

    // 2. Unpin DM if pinned
    if (localPinnedDms[key]) {
      setLocalPinnedDms((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      try {
        await togglePinDm(currentUsername, key, false);
      } catch (err) {
        console.error('Error unpinning deleted DM:', err);
      }
    }

    // 3. Mark DM as closed / removed from the DM list
    setLocalClosedDms((prev) => {
      const next = { ...prev, [key]: true };
      try {
        localStorage.setItem(`yapzo_closed_dms_${currentUsername}`, JSON.stringify(next));
      } catch {}
      return next;
    });
    try {
      await setClosedDm(currentUsername, key, true);
    } catch (err) {
      console.error('Error saving closed DM:', err);
    }

    // 4. If current active DM was deleted, switch to friends tab
    if (selectedDm.toLowerCase() === key) {
      setDmTab('friends');
    }

    setDmContextMenu(null);
  };

  // Open / Re-open a DM (from Friends tab, server member card, etc.)
  const handleOpenUserDm = async (targetUsername: string) => {
    const key = targetUsername.toLowerCase();

    // Remove from closed DMs so it appears back in the Direct Messages list
    setLocalClosedDms((prev) => {
      const next = { ...prev };
      delete next[key];
      try {
        localStorage.setItem(`yapzo_closed_dms_${currentUsername}`, JSON.stringify(next));
      } catch {}
      return next;
    });
    try {
      await setClosedDm(currentUsername, key, false);
    } catch (err) {
      console.error('Error reopening DM:', err);
    }

    setIsHomeSelected(true);
    setActiveServerId(null);
    setDmTab('dms');
    setSelectedDm(targetUsername);
  };

  // Add friend directly from server member profile modal
  const handleAddFriendFromModal = async (member: UserProfile) => {
    if (!member || member.username.toLowerCase() === currentUsername.toLowerCase()) return;
    try {
      const myProfile: UserProfile = {
        id: currentUsername,
        username: currentUsername,
        email: regEmail || loginEmail || 'user@yapzo.gg',
        displayName: currentDisplayName,
        avatar: avatarPreview,
        banner: bannerPreview,
        pronouns,
        aboutMe,
        status: userStatus,
        isMuted,
        isDeafened,
        createdAt: Date.now(),
        lastSeen: Date.now()
      };
      const res = await addFriend(myProfile, member.username);
      if (res.success) {
        setMemberModalFeedback(`Friend request sent to @${member.username}!`);
      } else {
        setMemberModalFeedback(res.error || 'Failed to send request');
      }
    } catch (err) {
      setMemberModalFeedback('Error sending friend request');
    }
  };

  // Filter messages based on localClearedDms
  const selfClearedAt = localClearedDms['self'] || 0;
  const displayedSelfMessages = selfMessages.filter((m) => m.createdAt > selfClearedAt);

  const dmClearedAt = localClearedDms[selectedDm.toLowerCase()] || 0;
  const displayedDmMessages = dmChatMessages.filter((m) => m.createdAt > dmClearedAt);

  // All active DM items list (Self note + Friends + Active Open DMs) excluding closed/deleted DMs
  const dmMap = new Map<string, {
    key: string;
    isSelf: boolean;
    username: string;
    displayName: string;
    avatar: string | null;
    status: UserStatus;
    isPinned: boolean;
    subtitle: string;
  }>();

  // Always include self note
  dmMap.set('self', {
    key: 'self',
    isSelf: true,
    username: 'self',
    displayName: currentDisplayName,
    avatar: avatarPreview,
    status: userStatus,
    isPinned: !!localPinnedDms['self'],
    subtitle:
      displayedSelfMessages.length > 0
        ? displayedSelfMessages[displayedSelfMessages.length - 1].text || '[Image]'
        : 'Message yourself'
  });

  // Include friends that have not been closed/deleted
  friends.forEach((friend) => {
    const k = friend.username.toLowerCase();
    if (!localClosedDms[k]) {
      dmMap.set(k, {
        key: k,
        isSelf: false,
        username: friend.username,
        displayName: friend.displayName || friend.username,
        avatar: friend.avatar,
        status: friend.status || 'offline',
        isPinned: !!localPinnedDms[k],
        subtitle: `@${friend.username}`
      });
    }
  });

  // If a specific DM is currently selected and not closed, make sure it appears in DM list
  if (selectedDm && selectedDm !== 'self') {
    const k = selectedDm.toLowerCase();
    if (!localClosedDms[k] && !dmMap.has(k)) {
      const uProfile = allUsers.find((u) => u.username.toLowerCase() === k);
      dmMap.set(k, {
        key: k,
        isSelf: false,
        username: uProfile?.username || selectedDm,
        displayName: uProfile?.displayName || uProfile?.username || selectedDm,
        avatar: uProfile?.avatar || null,
        status: uProfile?.status || 'offline',
        isPinned: !!localPinnedDms[k],
        subtitle: `@${uProfile?.username || selectedDm}`
      });
    }
  }

  const allDmItems = Array.from(dmMap.values());

  // Pinned DMs sorted at top of sidebar DM list
  const sortedDmItems = [...allDmItems].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return 0;
  });

  // Pinned DM shortcuts for top-left server column
  const pinnedDmShortcuts = allDmItems.filter((item) => item.isPinned && !item.isSelf);

  // Loading screen tip index
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [tipOpacity, setTipOpacity] = useState(true);

  // Transparent logo generated from /logo.png
  const [transparentLogoUrl, setTransparentLogoUrl] = useState<string | null>(null);

  // Click outside listener for menus
  const serverMenuRef = useRef<HTMLDivElement>(null);
  const userSettingsRef = useRef<HTMLDivElement>(null);

  // Crop apply handler with Cloudinary upload
  const handleCropApply = async (resultDataUrl: string) => {
    setIsUploadingImage(true);
    try {
      const cloudinaryUrl = await uploadToCloudinary(resultDataUrl);
      if (cropModal?.isAvatar) {
        if (isSettingsOpen) {
          setDraftAvatar(cloudinaryUrl);
        } else {
          setAvatarPreview(cloudinaryUrl);
        }
      } else {
        if (isSettingsOpen) {
          setDraftBanner(cloudinaryUrl);
        } else {
          setBannerPreview(cloudinaryUrl);
        }
      }
    } catch (err) {
      console.error('Failed to upload image to Cloudinary, falling back:', err);
      if (cropModal?.isAvatar) {
        if (isSettingsOpen) setDraftAvatar(resultDataUrl);
        else setAvatarPreview(resultDataUrl);
      } else {
        if (isSettingsOpen) setDraftBanner(resultDataUrl);
        else setBannerPreview(resultDataUrl);
      }
    } finally {
      setIsUploadingImage(false);
      setCropModal(null);
    }
  };

  // Settings handlers & draft management
  const openSettings = () => {
    setDraftDisplayName(regDisplayName);
    setDraftPronouns(pronouns);
    setDraftAboutMe(aboutMe);
    setDraftAvatar(avatarPreview);
    setDraftBanner(bannerPreview);
    setShowUserSettings(false);
    setIsSettingsOpen(true);
  };

  const closeSettings = () => {
    setDraftDisplayName(regDisplayName);
    setDraftPronouns(pronouns);
    setDraftAboutMe(aboutMe);
    setDraftAvatar(avatarPreview);
    setDraftBanner(bannerPreview);
    setIsSettingsOpen(false);
  };

  const handleResetSettings = () => {
    setDraftDisplayName(regDisplayName);
    setDraftPronouns(pronouns);
    setDraftAboutMe(aboutMe);
    setDraftAvatar(avatarPreview);
    setDraftBanner(bannerPreview);
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      let finalAvatar = draftAvatar;
      let finalBanner = draftBanner;
      if (draftAvatar && draftAvatar.startsWith('data:')) {
        finalAvatar = await uploadToCloudinary(draftAvatar);
      }
      if (draftBanner && draftBanner.startsWith('data:')) {
        finalBanner = await uploadToCloudinary(draftBanner);
      }

      setRegDisplayName(draftDisplayName);
      setPronouns(draftPronouns);
      setAboutMe(draftAboutMe);
      setAvatarPreview(finalAvatar);
      setBannerPreview(finalBanner);
      setDraftAvatar(finalAvatar);
      setDraftBanner(finalBanner);

      const targetUsername = regUsername.trim().toLowerCase() || (loginEmail ? loginEmail.split('@')[0].toLowerCase() : '');
      if (targetUsername) {
        await updateUserProfile(targetUsername, {
          displayName: draftDisplayName,
          pronouns: draftPronouns,
          aboutMe: draftAboutMe,
          avatar: finalAvatar,
          banner: finalBanner
        });
      }
    } catch (err) {
      console.error('Error saving settings to Firestore:', err);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleStatusChange = async (newStatus: UserStatus) => {
    setUserStatus(newStatus);
    setActiveSubMenu(null);
    setShowUserSettings(false);
    const targetUsername = regUsername.trim().toLowerCase() || (loginEmail ? loginEmail.split('@')[0].toLowerCase() : '');
    if (targetUsername) {
      await updateUserProfile(targetUsername, { status: newStatus });
    }
  };

  const handleToggleMute = async () => {
    const newVal = !isMuted;
    setIsMuted(newVal);
    const targetUsername = regUsername.trim().toLowerCase() || (loginEmail ? loginEmail.split('@')[0].toLowerCase() : '');
    if (targetUsername) {
      await updateUserProfile(targetUsername, { isMuted: newVal });
    }
  };

  const handleToggleDeafen = async () => {
    const newVal = !isDeafened;
    setIsDeafened(newVal);
    const targetUsername = regUsername.trim().toLowerCase() || (loginEmail ? loginEmail.split('@')[0].toLowerCase() : '');
    if (targetUsername) {
      await updateUserProfile(targetUsername, { isDeafened: newVal });
    }
  };

  const hasUnsavedChanges =
    isSettingsOpen &&
    (draftDisplayName !== regDisplayName ||
      draftPronouns !== pronouns ||
      draftAboutMe !== aboutMe ||
      draftAvatar !== avatarPreview ||
      draftBanner !== bannerPreview);

  // Close fullscreen settings, image preview lightbox, reply, server member modal or crop modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isServerSettingsOpen) {
          setIsServerSettingsOpen(false);
        } else if (showServerDropdown) {
          setShowServerDropdown(false);
        } else if (selectedServerMember) {
          setSelectedServerMember(null);
          setShowMemberMoreMenu(false);
        } else if (previewImageUrl) {
          setPreviewImageUrl(null);
        } else if (replyTarget) {
          setReplyTarget(null);
        } else if (cropModal) {
          setCropModal(null);
        } else if (isSettingsOpen) {
          setDraftDisplayName(regDisplayName);
          setDraftPronouns(pronouns);
          setDraftAboutMe(aboutMe);
          setDraftAvatar(avatarPreview);
          setDraftBanner(bannerPreview);
          setIsSettingsOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedServerMember, previewImageUrl, replyTarget, isSettingsOpen, cropModal, regDisplayName, pronouns, aboutMe, avatarPreview, bannerPreview]);

  // Scroll to bottom when self messages change
  useEffect(() => {
    if (selectedDm === 'self' && isHomeSelected) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selfMessages, selectedDm, isHomeSelected]);

  // Scroll to bottom when channel messages change
  useEffect(() => {
    if (activeServerId === 'yapzo-hq') {
      channelMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [channelMessages, activeChannelId, activeServerId]);

  // Real-time subscriptions for ALL Yapzo HQ server channels to detect pings in background
  useEffect(() => {
    if (screen !== 'app' || !currentUsername) return;

    const unsubs = YAPZO_HQ_CHANNELS.map((ch) => {
      return subscribeToChannelMessages(ch.id, (messages) => {
        setChannelMessages((prev) => ({
          ...prev,
          [ch.id]: messages
        }));

        // First initial load for this channel: record existing messages so we don't alert old history
        if (!initialSyncCompleteRef.current[ch.id]) {
          messages.forEach((m) => seenMessageIdsRef.current.add(m.id));
          initialSyncCompleteRef.current[ch.id] = true;
          return;
        }

        // Subsequent message updates: check for new incoming pings
        let newPingsCount = 0;
        messages.forEach((m) => {
          if (!seenMessageIdsRef.current.has(m.id)) {
            seenMessageIdsRef.current.add(m.id);

            if (isMessagePingForUser(m, currentUsernameRef.current, currentDisplayNameRef.current)) {
              // Are we currently active in this channel?
              const isCurrentlyInThisChannel =
                !isHomeSelectedRef.current &&
                activeServerIdRef.current === 'yapzo-hq' &&
                activeChannelIdRef.current === ch.id &&
                !document.hidden;

              if (!isCurrentlyInThisChannel) {
                newPingsCount += 1;
              }
            }
          }
        });

        if (newPingsCount > 0) {
          setChannelUnreadPings((prev) => {
            const updated = {
              ...prev,
              [ch.id]: (prev[ch.id] || 0) + newPingsCount
            };
            try {
              localStorage.setItem(`yapzo_unread_pings_${currentUsernameRef.current}`, JSON.stringify(updated));
            } catch {}
            return updated;
          });

          playPingSound();
        }
      });
    });

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [screen, currentUsername]);

  // Real-time Firestore subscriptions for self notes
  useEffect(() => {
    const targetUsername = regUsername.trim().toLowerCase() || (loginEmail ? loginEmail.split('@')[0].toLowerCase() : '');
    if (screen !== 'app' || !targetUsername) return;

    const unsubscribe = subscribeToSelfMessages(targetUsername, (messages) => {
      setSelfMessages(messages);
    });

    return () => unsubscribe();
  }, [screen, regUsername, loginEmail]);

  // Real-time Firestore subscriptions for all users (Player List)
  useEffect(() => {
    if (screen !== 'app') return;

    const unsubscribe = subscribeToAllUsers((users) => {
      setAllUsers(users);
    });

    return () => unsubscribe();
  }, [screen]);

  // Real-time listener for friends
  useEffect(() => {
    if (screen !== 'app' || !currentUsername) return;
    const unsubscribe = subscribeToFriends(currentUsername, (f) => {
      setFriends(f);
    });
    return () => unsubscribe();
  }, [screen, currentUsername]);

  // Real-time listener for 1-on-1 DM with selected friend
  useEffect(() => {
    if (screen !== 'app' || !currentUsername || selectedDm === 'self' || !selectedDm) {
      setDmChatMessages([]);
      return;
    }
    const unsubscribe = subscribeToDmMessages(currentUsername, selectedDm, (msgs) => {
      setDmChatMessages(msgs);
    });
    return () => unsubscribe();
  }, [screen, currentUsername, selectedDm]);

  // Scroll to bottom when 1-on-1 DM messages change
  useEffect(() => {
    if (selectedDm !== 'self' && isHomeSelected) {
      dmChatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [dmChatMessages, selectedDm, isHomeSelected]);

  // Real-time listener for channel typing
  useEffect(() => {
    if (screen !== 'app' || !activeChannelId || isHomeSelected) {
      setChannelTypingUsers([]);
      return;
    }
    const contextId = `channel_${activeChannelId}`;
    const unsubscribe = subscribeToTyping(contextId, (users) => {
      const others = users.filter((u) => u.username.toLowerCase() !== currentUsername.toLowerCase());
      setChannelTypingUsers(others);
    });
    return () => unsubscribe();
  }, [screen, activeChannelId, isHomeSelected, currentUsername]);

  // Real-time listener for DM typing
  useEffect(() => {
    if (screen !== 'app' || !isHomeSelected || selectedDm === 'self' || !selectedDm) {
      setDmTypingUsers([]);
      return;
    }
    const dmChatId = getDmChatId(currentUsername, selectedDm);
    const contextId = `dm_${dmChatId}`;
    const unsubscribe = subscribeToTyping(contextId, (users) => {
      const others = users.filter((u) => u.username.toLowerCase() !== currentUsername.toLowerCase());
      setDmTypingUsers(others);
    });
    return () => unsubscribe();
  }, [screen, isHomeSelected, selectedDm, currentUsername]);

  // Save session state to localStorage whenever relevant fields change
  useEffect(() => {
    if (screen === 'app') {
      const sessionToSave: StoredSession = {
        isLoggedIn: true,
        email: regEmail || loginEmail || 'user@yapzo.gg',
        displayName: regDisplayName || regUsername || (loginEmail ? loginEmail.split('@')[0] : 'juxtopposed'),
        username: regUsername || (loginEmail ? loginEmail.split('@')[0].toLowerCase() : 'juxtopposed'),
        pronouns,
        aboutMe,
        avatar: avatarPreview,
        banner: bannerPreview,
        status: userStatus,
        isMuted,
        isDeafened,
        dmTab,
        sortOrder,
        selfMessages,
        activeServerId,
        activeChannelId,
        channelMessages
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionToSave));
      } catch {}
    }
  }, [
    screen,
    regEmail,
    loginEmail,
    regDisplayName,
    regUsername,
    pronouns,
    aboutMe,
    avatarPreview,
    bannerPreview,
    userStatus,
    isMuted,
    isDeafened,
    dmTab,
    sortOrder,
    selfMessages,
    activeServerId,
    activeChannelId,
    channelMessages
  ]);

  // Real-time server settings subscription (Roles, Owner, Permissions, Profanity filter)
  useEffect(() => {
    const unsubscribe = subscribeToServerSettings((settings) => {
      setServerSettings(settings);
    });
    return () => unsubscribe();
  }, []);

  // Click outside to dismiss menus
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (serverMenuRef.current && !serverMenuRef.current.contains(e.target as Node)) {
        setShowServerMenu(false);
      }
      if (serverDropdownRef.current && !serverDropdownRef.current.contains(e.target as Node)) {
        setShowServerDropdown(false);
      }
      if (userSettingsRef.current && !userSettingsRef.current.contains(e.target as Node)) {
        setShowUserSettings(false);
        setActiveSubMenu(null);
      }
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setShowSortDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Remove white background from /logo.png
  useEffect(() => {
    const img = new Image();
    img.src = '/logo.png';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const size = 512;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0, size, size);
        const imgData = ctx.getImageData(0, 0, size, size);
        const data = imgData.data;

        const visited = new Uint8Array(size * size);
        const queue = new Int32Array(size * size);
        let qStart = 0;
        let qEnd = 0;

        const isWhiteBg = (idx: number) => {
          const r = data[idx * 4];
          const g = data[idx * 4 + 1];
          const b = data[idx * 4 + 2];
          return r > 218 && g > 218 && b > 218;
        };

        for (let x = 0; x < size; x++) {
          const topIdx = x;
          const botIdx = (size - 1) * size + x;
          if (isWhiteBg(topIdx) && !visited[topIdx]) {
            visited[topIdx] = 1;
            queue[qEnd++] = topIdx;
          }
          if (isWhiteBg(botIdx) && !visited[botIdx]) {
            visited[botIdx] = 1;
            queue[qEnd++] = botIdx;
          }
        }

        for (let y = 0; y < size; y++) {
          const leftIdx = y * size;
          const rightIdx = y * size + (size - 1);
          if (isWhiteBg(leftIdx) && !visited[leftIdx]) {
            visited[leftIdx] = 1;
            queue[qEnd++] = leftIdx;
          }
          if (isWhiteBg(rightIdx) && !visited[rightIdx]) {
            visited[rightIdx] = 1;
            queue[qEnd++] = rightIdx;
          }
        }

        while (qStart < qEnd) {
          const curr = queue[qStart++];
          data[curr * 4 + 3] = 0;

          const x = curr % size;
          const y = (curr / size) | 0;

          if (x > 0) {
            const next = curr - 1;
            if (!visited[next] && isWhiteBg(next)) {
              visited[next] = 1;
              queue[qEnd++] = next;
            }
          }
          if (x < size - 1) {
            const next = curr + 1;
            if (!visited[next] && isWhiteBg(next)) {
              visited[next] = 1;
              queue[qEnd++] = next;
            }
          }
          if (y > 0) {
            const next = curr - size;
            if (!visited[next] && isWhiteBg(next)) {
              visited[next] = 1;
              queue[qEnd++] = next;
            }
          }
          if (y < size - 1) {
            const next = curr + size;
            if (!visited[next] && isWhiteBg(next)) {
              visited[next] = 1;
              queue[qEnd++] = next;
            }
          }
        }

        for (let i = 0; i < size * size; i++) {
          if (visited[i]) continue;
          const r = data[i * 4];
          const g = data[i * 4 + 1];
          const b = data[i * 4 + 2];
          const x = i % size;
          const y = (i / size) | 0;

          const touchesTransparent =
            (x > 0 && visited[i - 1]) ||
            (x < size - 1 && visited[i + 1]) ||
            (y > 0 && visited[i - size]) ||
            (y < size - 1 && visited[i + size]);

          if (touchesTransparent && r > 190 && g > 190 && b > 190) {
            const brightness = (r + g + b) / 3;
            data[i * 4 + 3] = Math.max(0, Math.min(255, Math.round((255 - brightness) * 2.2)));
          }
        }

        ctx.putImageData(imgData, 0, 0);
        setTransparentLogoUrl(canvas.toDataURL('image/png'));
      } catch {
        setTransparentLogoUrl('/logo.png');
      }
    };
  }, []);

  // Tip rotation effect during loading screen
  useEffect(() => {
    if (screen !== 'loading') return;

    const interval = setInterval(() => {
      setTipOpacity(false);
      setTimeout(() => {
        setCurrentTipIndex((prev) => (prev + 1) % DISCORD_TIPS.length);
        setTipOpacity(true);
      }, 350);
    }, 4000);

    return () => clearInterval(interval);
  }, [screen]);

  // Loading screen transition
  useEffect(() => {
    if (screen !== 'loading') return;

    const timer = setTimeout(() => {
      setScreen('app');
    }, 2800);

    return () => clearTimeout(timer);
  }, [screen]);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const days = Array.from({ length: 31 }, (_, i) => String(i + 1));
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 90 }, (_, i) => String(currentYear - 3 - i));

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { email?: string; password?: string } = {};

    if (!loginEmail.trim()) {
      errors.email = 'This field is required';
    }
    if (!loginPassword) {
      errors.password = 'This field is required';
    }

    setLoginErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsLoggingIn(true);
    try {
      const user = await findUserByHandleOrEmail(loginEmail);
      if (!user) {
        setLoginErrors({ email: 'No account found with this email or username' });
        setIsLoggingIn(false);
        return;
      }

      if (user.password && user.password !== loginPassword) {
        setLoginErrors({ password: 'Password does not match our records' });
        setIsLoggingIn(false);
        return;
      }

      // Logged in! Update online status in Firestore
      await updateUserProfile(user.id, { status: 'online' });

      setRegEmail(user.email);
      setRegUsername(user.username);
      setRegDisplayName(user.displayName);
      setAvatarPreview(user.avatar);
      setBannerPreview(user.banner);
      setPronouns(user.pronouns || '');
      setAboutMe(user.aboutMe || '');
      setUserStatus(user.status || 'online');
      setIsMuted(user.isMuted ?? false);
      setIsDeafened(user.isDeafened ?? false);

      setLoginErrors({});
      setScreen('loading');
    } catch (err) {
      console.error('Error during login:', err);
      setScreen('loading');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { email?: string; username?: string; password?: string; dob?: string } = {};

    if (!regEmail.trim()) {
      errors.email = 'This field is required';
    } else if (!regEmail.includes('@') || !regEmail.includes('.')) {
      errors.email = 'Not a well formed email address';
    }

    if (!regUsername.trim()) {
      errors.username = 'This field is required';
    } else if (regUsername.trim().length < 2) {
      errors.username = 'Must be between 2 and 32 characters in length';
    } else if (!/^[a-zA-Z0-9_.-]+$/.test(regUsername.trim())) {
      errors.username = 'Only letters, numbers, underscores, and dashes allowed';
    }

    if (!regPassword) {
      errors.password = 'This field is required';
    } else if (regPassword.length < 8) {
      errors.password = 'Must be at least 8 characters long';
    }

    if (!birthMonth || !birthDay || !birthYear) {
      errors.dob = 'This field is required';
    }

    setRegErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsCheckingAccount(true);
    try {
      const { usernameTaken, emailTaken } = await checkHandleOrEmailExists(regUsername, regEmail);
      if (emailTaken) {
        setRegErrors({ email: 'This email is already in use by another account' });
        setIsCheckingAccount(false);
        return;
      }
      if (usernameTaken) {
        setRegErrors({ username: 'This handle / username is already taken' });
        setIsCheckingAccount(false);
        return;
      }

      setRegErrors({});
      setScreen('step1');
    } catch (err) {
      console.error('Error validating credentials with Firestore:', err);
      // Advance to step 1
      setScreen('step1');
    } finally {
      setIsCheckingAccount(false);
    }
  };

  // Upload handler triggering the Crop/Resize modal (or direct upload for animated GIFs)
  const handleSelectImageForCrop = async (e: React.ChangeEvent<HTMLInputElement>, isAvatar: boolean) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif')) {
        setIsUploadingImage(true);
        try {
          const gifUrl = await uploadToCloudinary(file);
          if (isAvatar) {
            if (isSettingsOpen) setDraftAvatar(gifUrl);
            else setAvatarPreview(gifUrl);
          } else {
            if (isSettingsOpen) setDraftBanner(gifUrl);
            else setBannerPreview(gifUrl);
          }
        } catch (err) {
          console.error('Error uploading GIF PFP/Banner:', err);
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            if (isAvatar) {
              if (isSettingsOpen) setDraftAvatar(dataUrl);
              else setAvatarPreview(dataUrl);
            } else {
              if (isSettingsOpen) setDraftBanner(dataUrl);
              else setBannerPreview(dataUrl);
            }
          };
          reader.readAsDataURL(file);
        } finally {
          setIsUploadingImage(false);
        }
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          setCropModal({
            isOpen: true,
            imageSrc: dataUrl,
            isAvatar
          });
        };
        reader.readAsDataURL(file);
      }
    }
    e.target.value = '';
  };

  const handleForgotPassword = () => {
    if (!loginEmail.trim()) {
      setLoginErrors({ email: 'Enter your email or username to reset password' });
      return;
    }
    setForgotPasswordSent(true);
    setLoginErrors({});
  };

  const handleFinishRegistration = async () => {
    if (!agreeTerms || !agreeGuidelines || !agreeRules) return;

    setIsRegistering(true);
    try {
      let finalAvatar = avatarPreview;
      let finalBanner = bannerPreview;

      // Upload images to Cloudinary if they are local data URLs
      if (avatarPreview && avatarPreview.startsWith('data:')) {
        finalAvatar = await uploadToCloudinary(avatarPreview);
      }
      if (bannerPreview && bannerPreview.startsWith('data:')) {
        finalBanner = await uploadToCloudinary(bannerPreview);
      }

      const normUsername = regUsername.trim().toLowerCase();
      const normEmail = regEmail.trim().toLowerCase();
      const effectiveDisplayName = regDisplayName.trim() || regUsername.trim();

      const newProfile: UserProfile = {
        id: normUsername,
        username: normUsername,
        email: normEmail,
        displayName: effectiveDisplayName,
        password: regPassword,
        avatar: finalAvatar,
        banner: finalBanner,
        pronouns: pronouns.trim(),
        aboutMe: aboutMe.trim(),
        status: 'online',
        isMuted: false,
        isDeafened: false,
        createdAt: Date.now(),
        lastSeen: Date.now(),
        birthDate: {
          month: birthMonth,
          day: birthDay,
          year: birthYear
        },
        newsletter: subscribeNewsletter
      };

      await saveUserProfile(newProfile);

      setAvatarPreview(finalAvatar);
      setBannerPreview(finalBanner);
      setRegUsername(normUsername);
      setRegDisplayName(effectiveDisplayName);
      setUserStatus('online');

      setScreen('loading');
    } catch (err) {
      console.error('Error completing registration:', err);
      setScreen('loading');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleLogout = async () => {
    const targetUsername = regUsername.trim().toLowerCase() || (loginEmail ? loginEmail.split('@')[0].toLowerCase() : '');
    if (targetUsername) {
      try {
        await updateUserProfile(targetUsername, { status: 'offline' });
      } catch {}
    }
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setChannelUnreadPings({});
    document.title = 'Yapzo';
    setShowUserSettings(false);
    setIsSettingsOpen(false);
    setActiveSubMenu(null);
    setScreen('auth');
    setMode('login');
  };

  // Handle selecting an image or GIF file (specifically disallows MP4)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, target: 'channel' | 'dm') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.includes('video') || file.name.toLowerCase().endsWith('.mp4')) {
      alert('Video (.mp4) is not supported yet. Please select an image or GIF.');
      e.target.value = '';
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('Please select an image or GIF file.');
      e.target.value = '';
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    if (target === 'channel') {
      setChannelAttachment({ file, previewUrl, name: file.name });
    } else {
      setDmAttachment({ file, previewUrl, name: file.name });
    }
    e.target.value = '';
  };

  // Send message in Direct Messages (either Self-notes or Friend 1-on-1)
  const handleSendDmMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text && !dmAttachment) return;

    let uploadedImageUrl: string | undefined = undefined;

    if (dmAttachment) {
      try {
        setIsUploadingAttachment(true);
        uploadedImageUrl = await uploadToCloudinary(dmAttachment.file);
      } catch (err) {
        console.error('Error uploading DM image:', err);
      } finally {
        setIsUploadingAttachment(false);
      }
    }

    const currentMsg: Omit<ChatMessage, 'id'> = {
      text,
      imageUrl: uploadedImageUrl || null,
      authorId: currentUsername,
      authorUsername: currentUsername,
      authorDisplayName: currentDisplayName,
      authorAvatar: avatarPreview || null,
      timestamp: formatDiscordTimestamp(),
      createdAt: Date.now(),
      replyTo: replyTarget && (replyTarget.location === 'dm' || replyTarget.location === 'self') ? {
        id: replyTarget.message.id,
        text: replyTarget.message.text || '',
        imageUrl: replyTarget.message.imageUrl || null,
        authorDisplayName: replyTarget.message.authorDisplayName,
        authorUsername: replyTarget.message.authorUsername,
        authorAvatar: replyTarget.message.authorAvatar || null
      } : null
    };

    setChatInput('');
    setDmAttachment(null);
    setReplyTarget(null);
    setMentionState(null);

    if (selectedDm !== 'self' && currentUsername) {
      const dmChatId = getDmChatId(currentUsername, selectedDm);
      if (dmTypingTimeoutRef.current) clearTimeout(dmTypingTimeoutRef.current);
      isDmTypingRef.current = false;
      setTypingStatus(`dm_${dmChatId}`, { username: currentUsername, displayName: currentDisplayName, avatar: avatarPreview }, false);
    }

    try {
      if (selectedDm === 'self') {
        await sendSelfMessage(currentUsername, currentMsg);
      } else {
        await sendDmMessage(currentUsername, selectedDm, currentMsg);
      }
    } catch (err) {
      console.error('Error sending DM message:', err);
    }
  };

  // Send message in server channel
  const handleSendChannelMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = channelChatInput.trim();
    if (!text && !channelAttachment) return;

    let uploadedImageUrl: string | undefined = undefined;

    if (channelAttachment) {
      try {
        setIsUploadingAttachment(true);
        uploadedImageUrl = await uploadToCloudinary(channelAttachment.file);
      } catch (err) {
        console.error('Error uploading channel image:', err);
      } finally {
        setIsUploadingAttachment(false);
      }
    }

    const currentMsg: Omit<ChatMessage, 'id'> = {
      channelId: activeChannelId,
      text: text,
      imageUrl: uploadedImageUrl || null,
      authorId: currentUsername,
      authorUsername: currentUsername,
      authorDisplayName: currentDisplayName,
      authorAvatar: avatarPreview || null,
      timestamp: formatDiscordTimestamp(),
      createdAt: Date.now(),
      replyTo: replyTarget && replyTarget.location === 'channel' ? {
        id: replyTarget.message.id,
        text: replyTarget.message.text || '',
        imageUrl: replyTarget.message.imageUrl || null,
        authorDisplayName: replyTarget.message.authorDisplayName,
        authorUsername: replyTarget.message.authorUsername,
        authorAvatar: replyTarget.message.authorAvatar || null
      } : null
    };

    setChannelChatInput('');
    setChannelAttachment(null);
    setReplyTarget(null);
    setMentionState(null);

    if (activeChannelId && currentUsername) {
      if (channelTypingTimeoutRef.current) clearTimeout(channelTypingTimeoutRef.current);
      isChannelTypingRef.current = false;
      setTypingStatus(`channel_${activeChannelId}`, { username: currentUsername, displayName: currentDisplayName, avatar: avatarPreview }, false);
    }

    try {
      await sendChannelMessage(activeChannelId, currentMsg);
    } catch (err) {
      console.error('Error sending channel message:', err);
    }
  };

  // Mention autocomplete search
  const handleMentionSearch = (text: string, target: 'channel' | 'dm', selectionStart?: number) => {
    const pos = selectionStart !== undefined ? selectionStart : text.length;
    const textBeforeCursor = text.slice(0, pos);
    const match = textBeforeCursor.match(/@([a-zA-Z0-9_.-]*)$/);

    if (!match) {
      setMentionState(null);
      return;
    }

    const query = match[1].toLowerCase();
    const mentionStart = match.index!;
    const candidates: MentionCandidate[] = [];

    if (target === 'channel') {
      // In a server channel: include @everyone first
      if ('everyone'.includes(query) || !query) {
        candidates.push({
          id: 'everyone',
          type: 'everyone',
          username: 'everyone',
          displayName: '@everyone',
          description: 'Notify everyone in this server'
        });
      }

      const seen = new Set<string>();
      const memberList: UserProfile[] = [...allUsers];
      if (currentUsername && !memberList.some((u) => u.username.toLowerCase() === currentUsername.toLowerCase())) {
        memberList.push({
          id: currentUsername,
          username: currentUsername,
          displayName: currentDisplayName,
          email: '',
          avatar: avatarPreview,
          banner: bannerPreview,
          pronouns,
          aboutMe,
          status: userStatus,
          isMuted,
          isDeafened,
          createdAt: Date.now(),
          lastSeen: Date.now()
        });
      }

      for (const u of memberList) {
        const uLower = (u.username || '').toLowerCase();
        if (seen.has(uLower)) continue;
        seen.add(uLower);
        const dLower = (u.displayName || '').toLowerCase();
        if (!query || uLower.includes(query) || dLower.includes(query)) {
          candidates.push({
            id: u.username,
            type: 'user',
            username: u.username,
            displayName: u.displayName || u.username,
            avatar: u.username.toLowerCase() === currentUsername.toLowerCase() ? avatarPreview : u.avatar,
            status: u.username.toLowerCase() === currentUsername.toLowerCase() ? userStatus : u.status,
            description: u.username.toLowerCase() === currentUsername.toLowerCase() ? 'You' : undefined
          });
        }
      }
    } else {
      // In a DM: only people in that DM
      const dmCandidates: MentionCandidate[] = [];
      if (selectedDm && selectedDm !== 'self') {
        const friendProfile = allUsers.find((u) => u.username.toLowerCase() === selectedDm.toLowerCase());
        dmCandidates.push({
          id: selectedDm,
          type: 'user',
          username: selectedDm,
          displayName: friendProfile?.displayName || selectedFriend?.displayName || selectedDm,
          avatar: friendProfile?.avatar || selectedFriend?.avatar || null,
          status: friendProfile?.status || selectedFriend?.status || 'offline'
        });
      }
      dmCandidates.push({
        id: currentUsername,
        type: 'user',
        username: currentUsername,
        displayName: currentDisplayName,
        avatar: avatarPreview,
        status: userStatus,
        description: 'You'
      });

      for (const p of dmCandidates) {
        const uLower = p.username.toLowerCase();
        const dLower = p.displayName.toLowerCase();
        if (!query || uLower.includes(query) || dLower.includes(query)) {
          candidates.push(p);
        }
      }
    }

    if (candidates.length > 0) {
      setMentionState({
        isOpen: true,
        query,
        cursorIndex: mentionStart,
        target,
        candidates,
        selectedIndex: 0
      });
    } else {
      setMentionState(null);
    }
  };

  const handleSelectMention = (candidate: MentionCandidate) => {
    if (!mentionState) return;
    const { target, cursorIndex } = mentionState;
    const isChannel = target === 'channel';
    const currentVal = isChannel ? channelChatInput : chatInput;
    const inputRef = isChannel ? channelInputRef : dmInputRef;

    const before = currentVal.slice(0, cursorIndex);
    const afterAt = currentVal.slice(cursorIndex + 1);
    const match = afterAt.match(/^[a-zA-Z0-9_.-]*/);
    const queryLen = match ? match[0].length : 0;
    const after = currentVal.slice(cursorIndex + 1 + queryLen);

    const tagText = candidate.type === 'everyone' ? '@everyone ' : `@${candidate.username} `;
    const newVal = before + tagText + after;

    if (isChannel) {
      setChannelChatInput(newVal);
    } else {
      setChatInput(newVal);
    }

    setMentionState(null);

    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const nextPos = (before + tagText).length;
        inputRef.current.setSelectionRange(nextPos, nextPos);
      }
    }, 20);
  };

  const handleInputKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    target: 'channel' | 'dm'
  ) => {
    if (mentionState && mentionState.isOpen && mentionState.target === target) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionState((prev) =>
          prev
            ? { ...prev, selectedIndex: (prev.selectedIndex + 1) % prev.candidates.length }
            : null
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionState((prev) =>
          prev
            ? {
                ...prev,
                selectedIndex:
                  (prev.selectedIndex - 1 + prev.candidates.length) % prev.candidates.length
              }
            : null
        );
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const candidate = mentionState.candidates[mentionState.selectedIndex];
        if (candidate) {
          handleSelectMention(candidate);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionState(null);
        return;
      }
    }
  };

  const handleChannelInputChange = (val: string, selectionStart?: number) => {
    setChannelChatInput(val);
    handleMentionSearch(val, 'channel', selectionStart);

    if (!activeChannelId || !currentUsername) return;
    const contextId = `channel_${activeChannelId}`;
    const userObj = {
      username: currentUsername,
      displayName: currentDisplayName,
      avatar: avatarPreview
    };

    if (val.trim().length > 0) {
      if (!isChannelTypingRef.current) {
        isChannelTypingRef.current = true;
        setTypingStatus(contextId, userObj, true);
      }
      if (channelTypingTimeoutRef.current) clearTimeout(channelTypingTimeoutRef.current);
      channelTypingTimeoutRef.current = setTimeout(() => {
        isChannelTypingRef.current = false;
        setTypingStatus(contextId, userObj, false);
      }, 3500);
    } else {
      if (channelTypingTimeoutRef.current) clearTimeout(channelTypingTimeoutRef.current);
      isChannelTypingRef.current = false;
      setTypingStatus(contextId, userObj, false);
    }
  };

  const handleDmInputChange = (val: string, selectionStart?: number) => {
    setChatInput(val);
    handleMentionSearch(val, 'dm', selectionStart);

    if (selectedDm === 'self' || !currentUsername) return;
    const dmChatId = getDmChatId(currentUsername, selectedDm);
    const contextId = `dm_${dmChatId}`;
    const userObj = {
      username: currentUsername,
      displayName: currentDisplayName,
      avatar: avatarPreview
    };

    if (val.trim().length > 0) {
      if (!isDmTypingRef.current) {
        isDmTypingRef.current = true;
        setTypingStatus(contextId, userObj, true);
      }
      if (dmTypingTimeoutRef.current) clearTimeout(dmTypingTimeoutRef.current);
      dmTypingTimeoutRef.current = setTimeout(() => {
        isDmTypingRef.current = false;
        setTypingStatus(contextId, userObj, false);
      }, 3500);
    } else {
      if (dmTypingTimeoutRef.current) clearTimeout(dmTypingTimeoutRef.current);
      isDmTypingRef.current = false;
      setTypingStatus(contextId, userObj, false);
    }
  };

  // Delete message handlers (only allows deleting your own messages)
  const handleDeleteMessage = async (msg: ChatMessage, location: 'channel' | 'dm' | 'self') => {
    if (msg.authorUsername.toLowerCase() !== currentUsername.toLowerCase()) return;
    try {
      if (location === 'channel') {
        await deleteChannelMessage(activeChannelId, msg.id);
      } else if (location === 'self') {
        await deleteSelfMessage(currentUsername, msg.id);
      } else {
        await deleteDmMessage(getDmChatId(currentUsername, selectedDm), msg.id);
      }
    } catch (err) {
      console.error('Error deleting message:', err);
    }
  };

  // Toggle reaction on a message
  const handleToggleReaction = async (msg: ChatMessage, emoji: string, location: 'channel' | 'dm' | 'self') => {
    try {
      const contextKey =
        location === 'channel'
          ? activeChannelId
          : location === 'self'
          ? currentUsername
          : getDmChatId(currentUsername, selectedDm);
      await toggleMessageReaction(location, contextKey, msg.id, emoji, currentUsername);
    } catch (err) {
      console.error('Error toggling reaction:', err);
    }
  };

  // Add friend handler
  const handleAddFriendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addFriendInput.trim()) return;

    setIsAddingFriend(true);
    setAddFriendStatus(null);

    try {
      const myProfile: UserProfile = {
        id: currentUsername,
        username: currentUsername,
        email: regEmail || loginEmail || 'user@yapzo.gg',
        displayName: currentDisplayName,
        avatar: avatarPreview,
        banner: bannerPreview,
        pronouns,
        aboutMe,
        status: userStatus,
        isMuted,
        isDeafened,
        createdAt: Date.now(),
        lastSeen: Date.now()
      };

      const res = await addFriend(myProfile, addFriendInput.trim());
      if (res.success && res.friend) {
        setAddFriendStatus({
          type: 'success',
          message: `Success! Added @${res.friend.displayName || res.friend.username} as your friend.`
        });
        setAddFriendInput('');
      } else {
        setAddFriendStatus({
          type: 'error',
          message: res.error || 'Failed to add friend.'
        });
      }
    } catch (err) {
      setAddFriendStatus({
        type: 'error',
        message: 'Something went wrong while adding friend. Please check the username.'
      });
    } finally {
      setIsAddingFriend(false);
    }
  };

  // Remove friend handler
  const handleRemoveFriendAction = async (friendUsername: string) => {
    try {
      await removeFriend(currentUsername, friendUsername);
      if (selectedDm.toLowerCase() === friendUsername.toLowerCase()) {
        setSelectedDm('self');
      }
    } catch (err) {
      console.error('Error removing friend:', err);
    }
  };

  // Accept friend request handler
  const handleAcceptFriendRequestAction = async (friendUsername: string) => {
    try {
      await acceptFriendRequest(currentUsername, friendUsername);
    } catch (err) {
      console.error('Error accepting friend request:', err);
    }
  };

  // Decline/Cancel friend request handler
  const handleDeclineFriendRequestAction = async (friendUsername: string) => {
    try {
      await declineFriendRequest(currentUsername, friendUsername);
      if (selectedDm.toLowerCase() === friendUsername.toLowerCase()) {
        setSelectedDm('self');
      }
    } catch (err) {
      console.error('Error declining friend request:', err);
    }
  };

  const allAgreed = agreeTerms && agreeGuidelines && agreeRules;

  // Sorted messages based on user filter preference
  const displayedMessages = [...selfMessages].sort((a, b) => {
    if (sortOrder === 'oldest') {
      return a.createdAt - b.createdAt;
    }
    // Default newest order: standard chronological chat with newest at the bottom
    return a.createdAt - b.createdAt;
  });

  // SCREEN: CLASSIC DISCORD LAYOUT WITH SELF-DM CAPABILITY
  if (screen === 'app') {
    return (
      <div className="h-screen w-screen bg-[#0e0e10] text-[#dbdee1] flex overflow-hidden select-none font-['Inter',system-ui,-apple-system,sans-serif] relative">
        {/* LEFTMOST SERVER COLUMN */}
        <aside className="w-[72px] bg-[#0e0e10] flex flex-col items-center py-3 flex-shrink-0 z-20">
          <div className="flex flex-col items-center w-full gap-2">
            {/* Top Left Logo Button (Direct Messages) */}
            <div className="relative flex items-center justify-center w-full group">
              <div
                className={`absolute left-0 w-1 rounded-r-full bg-[#ff6b00] transition-all duration-200 ${
                  isHomeSelected ? 'h-10' : 'h-0 group-hover:h-5'
                }`}
              />

              <button
                type="button"
                onClick={() => {
                  setIsHomeSelected(true);
                  setActiveServerId(null);
                  setShowServerMenu(false);
                  setSelectedDm('self');
                }}
                className={`w-12 h-12 flex items-center justify-center transition-all duration-200 cursor-pointer overflow-hidden ${
                  isHomeSelected
                    ? 'rounded-[16px] bg-[#ff6b00] shadow-[0_0_16px_rgba(255,107,0,0.4)]'
                    : 'rounded-[24px] hover:rounded-[16px] bg-[#18191c] hover:bg-[#ff6b00]'
                }`}
                title="Direct Messages"
              >
                {transparentLogoUrl ? (
                  <img
                    src={transparentLogoUrl}
                    alt="Yapzo Home"
                    className="w-8 h-8 object-contain"
                  />
                ) : (
                  <img
                    src="/logo.png"
                    alt="Yapzo Home"
                    className="w-8 h-8 object-contain"
                  />
                )}
              </button>
            </div>

            {/* PINNED DM SHORTCUT AVATARS UNDER DIRECT MESSAGES ICON */}
            {pinnedDmShortcuts.map((item) => {
              const isActive = isHomeSelected && selectedDm.toLowerCase() === item.username.toLowerCase();
              const statusInfo = STATUS_CONFIG[item.status] || STATUS_CONFIG.offline;
              return (
                <div key={item.key} className="relative flex items-center justify-center w-full group my-0.5">
                  <div
                    className={`absolute left-0 w-1 rounded-r-full bg-[#ff6b00] transition-all duration-200 ${
                      isActive ? 'h-10' : 'h-0 group-hover:h-5'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsHomeSelected(true);
                      setActiveServerId(null);
                      setDmTab('dms');
                      setSelectedDm(item.username);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setDmContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        targetDm: item.username,
                        targetDisplayName: item.displayName,
                        targetAvatar: item.avatar
                      });
                    }}
                    className={`w-12 h-12 relative flex items-center justify-center transition-all duration-200 cursor-pointer overflow-hidden ${
                      isActive
                        ? 'rounded-[16px] ring-2 ring-[#ff6b00] shadow-[0_0_12px_rgba(255,107,0,0.3)]'
                        : 'rounded-[24px] hover:rounded-[16px] bg-[#18191c]'
                    }`}
                    title={`Pinned DM: ${item.displayName}`}
                  >
                    {item.avatar ? (
                      <img src={item.avatar} alt={item.displayName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-[#2b2d31] flex items-center justify-center text-white font-bold text-[16px]">
                        {item.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div
                      className={`absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full border-2 border-[#111214] ${statusInfo.bgClass}`}
                    />
                  </button>
                </div>
              );
            })}

            {/* Separator */}
            <div className="w-8 h-[2px] bg-[#232428] rounded my-0.5" />

            {/* YAPZO HQ SERVER BUTTON (AUTO-JOINED BY EVERYONE) */}
            <div className="relative flex items-center justify-center w-full group">
              <div
                className={`absolute left-0 w-1 rounded-r-full bg-[#ff6b00] transition-all duration-200 ${
                  !isHomeSelected && activeServerId === 'yapzo-hq'
                    ? 'h-10'
                    : totalServerPings > 0
                    ? 'h-2'
                    : 'h-0 group-hover:h-5'
                }`}
              />

              <button
                type="button"
                onClick={() => {
                  setIsHomeSelected(false);
                  setActiveServerId('yapzo-hq');
                  setShowServerMenu(false);
                }}
                className={`w-12 h-12 flex items-center justify-center transition-all duration-200 cursor-pointer font-bold select-none text-[14px] tracking-wide relative overflow-hidden ${
                  !isHomeSelected && activeServerId === 'yapzo-hq'
                    ? 'rounded-[16px] bg-[#ff6b00] text-white shadow-[0_0_16px_rgba(255,107,0,0.4)]'
                    : 'rounded-[24px] hover:rounded-[16px] bg-[#18191c] hover:bg-[#ff6b00] text-[#dbdee1] hover:text-white'
                }`}
                title={serverSettings.name || 'Yapzo HQ'}
              >
                {serverSettings.icon ? (
                  <img
                    src={serverSettings.icon}
                    alt={serverSettings.name || 'Server Icon'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>YHQ</span>
                )}

                {/* Server Notification Dot Badge: (1) or (99+) */}
                {totalServerPings > 0 && (
                  <div
                    className="absolute -top-1 -right-1.5 bg-[#f23f43] text-white text-[10px] font-bold px-1 min-w-[20px] h-[19px] rounded-full flex items-center justify-center border-2 border-[#111214] shadow-md z-10 pointer-events-none select-none animate-in zoom-in-75 duration-150"
                    title={`${totalServerPings} unread ping${totalServerPings === 1 ? '' : 's'}`}
                  >
                    {totalServerPings > 99 ? '(99+)' : `(${totalServerPings})`}
                  </div>
                )}
              </button>
            </div>

            {/* Separator */}
            <div className="w-8 h-[2px] bg-[#232428] rounded my-0.5" />

            {/* 4-CIRCLES BUTTON */}
            <div className="relative flex items-center justify-center w-full" ref={serverMenuRef}>
              <button
                type="button"
                onClick={() => setShowServerMenu(!showServerMenu)}
                className={`w-12 h-12 rounded-[24px] hover:rounded-[16px] transition-all duration-200 flex items-center justify-center cursor-pointer group ${
                  showServerMenu ? 'rounded-[16px] bg-[#232428] text-white' : 'bg-[#18191c] hover:bg-[#232428]'
                }`}
                title="Server Options"
              >
                <svg
                  className={`w-5 h-5 transition-colors ${
                    showServerMenu ? 'text-white' : 'text-[#dbdee1] group-hover:text-white'
                  }`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <circle cx="7" cy="7" r="3.2" />
                  <circle cx="17" cy="7" r="3.2" />
                  <circle cx="7" cy="17" r="3.2" />
                  <circle cx="17" cy="17" r="3.2" />
                </svg>
              </button>

              {/* 3 OPTIONS MENU */}
              {showServerMenu && (
                <div className="absolute left-[76px] top-0 w-52 bg-[#18191c] border border-[#232428] rounded-[6px] shadow-2xl p-1.5 z-50 animate-in fade-in slide-in-from-left-2 duration-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowServerMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-[14px] font-medium text-white hover:bg-[#232428] rounded-[4px] transition-colors cursor-pointer text-left"
                  >
                    <Plus className="w-4 h-4 text-[#ff6b00] stroke-[2.8]" />
                    <span>Add Server</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowServerMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-[14px] font-medium text-white hover:bg-[#232428] rounded-[4px] transition-colors cursor-pointer text-left"
                  >
                    <div className="w-5 h-5 rounded-full bg-[#ff6b00]/20 flex items-center justify-center">
                      <Compass className="w-3.5 h-3.5 text-[#ff6b00]" />
                    </div>
                    <span>Discover</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowServerMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-[14px] font-medium text-white hover:bg-[#232428] rounded-[4px] transition-colors cursor-pointer text-left"
                  >
                    <div className="w-5 h-5 rounded-full bg-[#ff6b00] flex items-center justify-center text-white">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                    <span>Show all servers</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* SECOND COLUMN: DM / SERVER CHANNELS SIDEBAR */}
        <div className="w-60 bg-[#18191c] flex flex-col flex-shrink-0 border-r border-[#111214]/60 relative">
          {isHomeSelected ? (
            <>
              {/* Top Header: DMs or Friends buttons + Newest/Oldest filter pill + Search & Plus */}
              <div className="pt-3 pb-2.5 px-3 border-b border-[#111214] flex flex-col gap-2.5 flex-shrink-0">
                {/* Row 1: Two buttons "DMs" and "Friends" */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDmTab('dms')}
                    className={`flex-1 py-1 px-3 text-[14px] font-semibold rounded-[5px] transition-colors cursor-pointer text-center ${
                      dmTab === 'dms'
                        ? 'bg-[#2b2d31] text-white shadow-xs'
                        : 'text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#232428]'
                    }`}
                  >
                    DMs
                  </button>
                  <button
                    type="button"
                    onClick={() => setDmTab('friends')}
                    className={`flex-1 py-1 px-3 text-[14px] font-semibold rounded-[5px] transition-colors cursor-pointer text-center ${
                      dmTab === 'friends'
                        ? 'bg-[#2b2d31] text-white shadow-xs'
                        : 'text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#232428]'
                    }`}
                  >
                    Friends
                  </button>
                </div>

                {/* Row 2: Filter from Newest to Oldest + Search & Plus */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1" ref={sortMenuRef}>
                    <button
                      type="button"
                      onClick={() => setShowSortDropdown(!showSortDropdown)}
                      className="w-full h-8 bg-[#111214] hover:bg-[#232428] text-[#dbdee1] hover:text-white rounded-[16px] px-2.5 text-[13px] font-medium flex items-center justify-between transition-colors cursor-pointer"
                      title="Filter sort order"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <ArrowUpDown className="w-3.5 h-3.5 text-[#949ba4]" />
                        <span className="capitalize">{sortOrder}</span>
                      </div>
                      <ChevronDown className="w-3.5 h-3.5 text-[#949ba4]" />
                    </button>

                    {showSortDropdown && (
                      <div className="absolute left-0 top-9 w-36 bg-[#18191c] border border-[#232428] rounded-[6px] shadow-2xl p-1 z-50 animate-in fade-in duration-100">
                        <button
                          type="button"
                          onClick={() => {
                            setSortOrder('newest');
                            setShowSortDropdown(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 text-[12px] rounded-[4px] transition-colors cursor-pointer text-left ${
                            sortOrder === 'newest'
                              ? 'bg-[#ff6b00]/20 text-[#ff8f3d]'
                              : 'text-[#dbdee1] hover:bg-[#232428] hover:text-white'
                          }`}
                        >
                          <span>Newest</span>
                          {sortOrder === 'newest' && <Check className="w-3.5 h-3.5 text-[#ff6b00]" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSortOrder('oldest');
                            setShowSortDropdown(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 text-[12px] rounded-[4px] transition-colors cursor-pointer text-left ${
                            sortOrder === 'oldest'
                              ? 'bg-[#ff6b00]/20 text-[#ff8f3d]'
                              : 'text-[#dbdee1] hover:bg-[#232428] hover:text-white'
                          }`}
                        >
                          <span>Oldest</span>
                          {sortOrder === 'oldest' && <Check className="w-3.5 h-3.5 text-[#ff6b00]" />}
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    className="w-8 h-8 rounded-full bg-[#111214] hover:bg-[#232428] text-[#949ba4] hover:text-white flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
                    title="Search conversation"
                  >
                    <Search className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    className="w-8 h-8 rounded-full bg-[#111214] hover:bg-[#232428] text-[#949ba4] hover:text-white flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
                    title="Create DM"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </div>
              </div>

              {/* DM CONVERSATIONS LIST (FEATURES DM OF YOURSELF + ALL ADDED FRIENDS) */}
              <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
                {dmTab === 'dms' ? (
                  <>
                    <div className="px-2 pb-1.5 text-[11px] font-bold text-[#949ba4] uppercase tracking-wider flex items-center justify-between">
                      <span>Direct Messages</span>
                    </div>

                    {/* DM CONVERSATIONS LIST (SORTED: PINNED FIRST, WITH RIGHT CLICK CONTEXT MENU) */}
                    {sortedDmItems.map((item) => {
                      const isSelected = selectedDm.toLowerCase() === item.username.toLowerCase();
                      const statusInfo = STATUS_CONFIG[item.status] || STATUS_CONFIG.offline;
                      return (
                        <div
                          key={item.key}
                          onClick={() => setSelectedDm(item.username)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setDmContextMenu({
                              x: e.clientX,
                              y: e.clientY,
                              targetDm: item.username,
                              targetDisplayName: item.displayName,
                              targetAvatar: item.avatar
                            });
                          }}
                          className={`flex items-center gap-3 px-2 py-2 rounded-[5px] cursor-pointer transition-colors group select-none ${
                            isSelected
                              ? 'bg-[#2b2d31] text-white shadow-xs'
                              : 'hover:bg-[#232428] text-[#949ba4] hover:text-[#dbdee1]'
                          }`}
                        >
                          <div className="relative flex-shrink-0">
                            <div className="w-8 h-8 rounded-full bg-[#111214] overflow-hidden flex items-center justify-center text-white ring-1 ring-[#232428]">
                              {item.avatar ? (
                                <img src={item.avatar} alt="Avatar" className="w-full h-full object-cover" />
                              ) : (
                                <User className="w-4 h-4 text-[#ff6b00]" />
                              )}
                            </div>
                            <div
                              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#18191c] ${statusInfo.bgClass}`}
                              title={statusInfo.label}
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 truncate">
                                <span className="text-[14px] font-medium truncate text-white">
                                  {item.displayName}
                                </span>
                                {item.isSelf && (
                                  <span className="text-[11px] text-[#80848e] bg-[#232428] px-1 rounded-[3px]">You</span>
                                )}
                              </div>
                              {item.isPinned && (
                                <span title="Pinned DM">
                                  <Pin className="w-3.5 h-3.5 text-[#ff6b00] flex-shrink-0" />
                                </span>
                              )}
                            </div>
                            <p className="text-[12px] text-[#949ba4] truncate mt-0.5">
                              {item.subtitle}
                            </p>
                          </div>
                        </div>
                      );
                    })}

                    {friends.length === 0 && (
                      <div className="px-2 pt-3 text-[12px] text-[#80848e] leading-relaxed">
                        Add friends in the <span className="text-[#ff8f3d] font-medium cursor-pointer hover:underline" onClick={() => setDmTab('friends')}>Friends tab</span> to message them directly. Right-click any DM to pin or clear chat.
                      </div>
                    )}
                  </>
                ) : (
                  /* FRIENDS TAB SIDEBAR */
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setFriendsFilterTab('online')}
                      className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-[5px] cursor-pointer transition-colors text-left text-[14px] font-medium ${
                        friendsFilterTab === 'online'
                          ? 'bg-[#2b2d31] text-white'
                          : 'text-[#949ba4] hover:bg-[#232428] hover:text-[#dbdee1]'
                      }`}
                    >
                      <Users className="w-4 h-4 text-[#23a55a]" />
                      <span>Online Friends ({friends.filter(f => f.status && f.status !== 'offline').length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFriendsFilterTab('all')}
                      className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-[5px] cursor-pointer transition-colors text-left text-[14px] font-medium ${
                        friendsFilterTab === 'all'
                          ? 'bg-[#2b2d31] text-white'
                          : 'text-[#949ba4] hover:bg-[#232428] hover:text-[#dbdee1]'
                      }`}
                    >
                      <Users className="w-4 h-4 text-[#80848e]" />
                      <span>All Friends ({friends.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFriendsFilterTab('add')}
                      className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-[5px] cursor-pointer transition-colors text-left text-[14px] font-medium ${
                        friendsFilterTab === 'add'
                          ? 'bg-[#ff6b00]/20 text-[#ff8f3d]'
                          : 'text-[#949ba4] hover:bg-[#232428] hover:text-[#dbdee1]'
                      }`}
                    >
                      <UserPlus className="w-4 h-4 text-[#ff6b00]" />
                      <span>Add Friend</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : activeServerId === 'yapzo-hq' ? (
            <>
              {/* SERVER HEADER: Yapzo HQ with Dropdown */}
              <div className="relative flex-shrink-0" ref={serverDropdownRef}>
                <div
                  onClick={() => {
                    if (canManageServer) {
                      setShowServerDropdown(!showServerDropdown);
                    }
                  }}
                  className={`h-12 border-b border-[#111214] px-4 font-bold text-white flex items-center justify-between ${
                    canManageServer ? 'hover:bg-[#232428]/60 cursor-pointer' : 'cursor-default'
                  } transition-colors shadow-xs select-none`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="truncate text-[15px] font-bold">{serverSettings.name || 'Yapzo HQ'}</span>
                    {isServerOwner && (
                      <span title="Server Owner">
                        <Crown className="w-4 h-4 text-[#f0b232] flex-shrink-0" />
                      </span>
                    )}
                  </div>
                  {canManageServer && (
                    <ChevronDown
                      className={`w-4 h-4 text-[#949ba4] flex-shrink-0 transition-transform duration-200 ${
                        showServerDropdown ? 'rotate-180 text-white' : ''
                      }`}
                    />
                  )}
                </div>

                {/* DISCORD SERVER DROPDOWN MENU - ONLY SHOWS SERVER SETTINGS */}
                {showServerDropdown && canManageServer && (
                  <div className="absolute left-2 right-2 top-14 bg-[#111214] border border-[#232428] rounded-[6px] shadow-2xl p-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <button
                      type="button"
                      onClick={() => {
                        setShowServerDropdown(false);
                        setIsServerSettingsOpen(true);
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-2 text-[13px] text-white hover:bg-[#ff6b00] rounded-[4px] transition-colors cursor-pointer text-left font-medium group"
                    >
                      <div className="flex items-center gap-2">
                        <Settings className="w-4 h-4 text-[#ff6b00] group-hover:text-white" />
                        <span>Server Settings</span>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* SERVER BANNER (Image, GIF, or Gradient under Title and above Channels) */}
              {serverSettings.banner && (
                <div className="w-full h-32 relative overflow-hidden flex-shrink-0 border-b border-[#111214]">
                  {serverSettings.bannerType === 'image' ||
                  serverSettings.banner.startsWith('http') ||
                  serverSettings.banner.startsWith('data:') ? (
                    <img
                      src={serverSettings.banner}
                      alt={`${serverSettings.name} Banner`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-full"
                      style={{ background: serverSettings.banner }}
                    />
                  )}
                  {/* Subtle dark gradient overlay at bottom of banner like Discord */}
                  <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#18191c] to-transparent pointer-events-none" />
                </div>
              )}

              {/* CHANNELS LIST: categorized */}
              <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4 select-none">
                {['Information', 'Text Channels'].map((cat) => {
                  const channelsInCat = YAPZO_HQ_CHANNELS.filter((ch) => ch.category === cat);
                  if (channelsInCat.length === 0) return null;
                  return (
                    <div key={cat} className="space-y-0.5">
                      <div className="px-2 pt-1 pb-1 flex items-center justify-between text-[#949ba4] text-[11px] font-bold tracking-wider uppercase">
                        <div className="flex items-center gap-1">
                          <ChevronDown className="w-3 h-3" />
                          <span>{cat}</span>
                        </div>
                      </div>

                      {channelsInCat.map((ch) => {
                        const isActive = !isHomeSelected && activeServerId === 'yapzo-hq' && activeChannelId === ch.id;
                        const pingCount = channelUnreadPings[ch.id] || 0;
                        return (
                          <button
                            key={ch.id}
                            type="button"
                            onClick={() => {
                              setActiveChannelId(ch.id);
                              setIsHomeSelected(false);
                              setActiveServerId('yapzo-hq');
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[4px] text-[15px] font-medium transition-colors cursor-pointer group text-left ${
                              isActive
                                ? 'bg-[#2b2d31] text-white font-semibold'
                                : pingCount > 0
                                ? 'text-white font-semibold hover:bg-[#232428]/60'
                                : 'text-[#949ba4] hover:bg-[#232428]/60 hover:text-[#dbdee1]'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
                              <Hash
                                className={`w-5 h-5 flex-shrink-0 ${
                                  isActive
                                    ? 'text-white'
                                    : pingCount > 0
                                    ? 'text-white'
                                    : 'text-[#80848e] group-hover:text-[#dbdee1]'
                                }`}
                              />
                              <span className="truncate">{ch.name}</span>
                            </div>

                            {/* Ping count badge for channel */}
                            {pingCount > 0 && (
                              <div
                                className="ml-2 flex-shrink-0 bg-[#f23f43] text-white text-[11px] font-bold px-1.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center shadow-xs select-none animate-in zoom-in-75 duration-150"
                                title={`${pingCount} unread mention${pingCount === 1 ? '' : 's'}`}
                              >
                                {pingCount > 99 ? '99+' : pingCount}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}

          {/* DOCKED BOTTOM USER NAVIGATION BAR */}
          <div className="h-[54px] bg-[#111214] px-2.5 flex items-center justify-between flex-shrink-0 relative border-t border-[#18191c]">
            {/* User identity & 2 indicators */}
            <div
              onClick={() => {
                setShowUserSettings(!showUserSettings);
                setActiveSubMenu(null);
              }}
              className="flex items-center gap-2.5 p-1 -ml-1 rounded-[4px] hover:bg-[#232428] cursor-pointer transition-colors max-w-[130px] overflow-hidden"
              title="Click for settings & status"
            >
              <div className="relative flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-[#2b2d31] overflow-hidden flex items-center justify-center text-white">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-4 h-4 text-[#ff6b00]" />
                  )}
                </div>

                {/* TWO INDICATORS STACKED NEXT TO PFP */}
                <div className="absolute -right-1 top-0 bottom-0 flex flex-col justify-between py-0.5 pointer-events-none">
                  <div
                    className={`w-2 h-2 rounded-full border border-[#111214] ${
                      isMuted ? 'bg-[#f23f43]' : 'bg-[#23a55a]'
                    }`}
                  />
                  <div
                    className={`w-2 h-2 rounded-full border border-[#111214] ${
                      STATUS_CONFIG[userStatus].bgClass
                    }`}
                  />
                </div>
              </div>

              <div className="min-w-0 flex-1 pl-1">
                <p className="text-[13px] font-semibold text-white leading-tight truncate">
                  {currentDisplayName}
                </p>
                <p className="text-[11px] text-[#949ba4] leading-tight truncate">
                  {STATUS_CONFIG[userStatus].label}
                </p>
              </div>
            </div>

            {/* Utility action buttons */}
            <div className="flex items-center gap-0.5 text-[#949ba4]">
              <button
                type="button"
                onClick={handleToggleMute}
                className={`p-1.5 rounded-[4px] hover:bg-[#232428] hover:text-[#dbdee1] transition-colors cursor-pointer ${
                  isMuted ? 'text-[#f23f43]' : ''
                }`}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                <Mic className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleToggleDeafen}
                className={`p-1.5 rounded-[4px] hover:bg-[#232428] hover:text-[#dbdee1] transition-colors cursor-pointer ${
                  isDeafened ? 'text-[#f23f43]' : ''
                }`}
                title={isDeafened ? 'Undeafen' : 'Deafen'}
              >
                <Headphones className="w-4 h-4" />
              </button>

              {/* Click Settings Icon to open Fullscreen Discord Settings */}
              <button
                type="button"
                onClick={openSettings}
                className="p-1.5 rounded-[4px] hover:bg-[#232428] hover:text-[#dbdee1] transition-colors cursor-pointer"
                title="User Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>

            {/* USER POPUP MENU */}
            {showUserSettings && (
              <div
                ref={userSettingsRef}
                className="absolute bottom-16 left-2 w-56 bg-[#18191c] border border-[#232428] rounded-[6px] shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
              >
                <div className="px-2.5 py-2 border-b border-[#232428] mb-1">
                  <p className="text-white text-[13px] font-semibold truncate">{currentDisplayName}</p>
                  <p className="text-[#949ba4] text-[11px] truncate">@{currentUsername}</p>
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setActiveSubMenu(activeSubMenu === 'status' ? null : 'status')}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 text-[13px] text-[#dbdee1] hover:bg-[#232428] hover:text-white rounded-[4px] transition-colors cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${STATUS_CONFIG[userStatus].bgClass}`} />
                      <span>Status</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#949ba4]" />
                  </button>

                  {activeSubMenu === 'status' && (
                    <div className="absolute left-[228px] -top-8 w-48 bg-[#18191c] border border-[#232428] rounded-[6px] shadow-2xl p-1.5 z-50 animate-in fade-in slide-in-from-left-1 duration-100">
                      {(['online', 'idle', 'dnd', 'offline'] as UserStatus[]).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => handleStatusChange(st)}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 text-[13px] rounded-[4px] transition-colors cursor-pointer text-left ${
                            userStatus === st
                              ? 'bg-[#ff6b00]/20 text-[#ff8f3d]'
                              : 'text-[#dbdee1] hover:bg-[#232428] hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${STATUS_CONFIG[st].bgClass}`} />
                            <span>{STATUS_CONFIG[st].label}</span>
                          </div>
                          {userStatus === st && <Check className="w-3.5 h-3.5 text-[#ff6b00]" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Open full Settings option */}
                <button
                  type="button"
                  onClick={openSettings}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[13px] text-[#dbdee1] hover:bg-[#232428] hover:text-white rounded-[4px] transition-colors cursor-pointer text-left"
                >
                  <Settings className="w-4 h-4 text-[#ff6b00]" />
                  <span>Profile Settings</span>
                </button>

                <div className="w-full h-[1px] bg-[#232428] my-1" />

                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[13px] text-[#f23f43] hover:bg-[#f23f43]/15 rounded-[4px] transition-colors cursor-pointer text-left"
                >
                  <LogOut className="w-4 h-4" /> Log Out
                </button>
              </div>
            )}
          </div>
        </div>

        {/* MAIN BODY AREA: EITHER HOME (DM) OR YAPZO HQ SERVER CHANNELS */}
        <main className="flex-1 bg-[#111214] flex flex-col min-w-0 relative">
          {isHomeSelected ? (
            dmTab === 'friends' ? (
              <FriendsView
                friends={friends}
                filterTab={friendsFilterTab}
                onFilterTabChange={setFriendsFilterTab}
                addFriendInput={addFriendInput}
                onAddFriendInputChange={setAddFriendInput}
                onAddFriendSubmit={handleAddFriendSubmit}
                addFriendStatus={addFriendStatus}
                isAddingFriend={isAddingFriend}
                onOpenDm={(friendUser) => {
                  handleOpenUserDm(friendUser);
                }}
                onRemoveFriend={handleRemoveFriendAction}
                onAcceptFriendRequest={handleAcceptFriendRequestAction}
                onDeclineFriendRequest={handleDeclineFriendRequestAction}
                statusConfig={STATUS_CONFIG}
              />
            ) : selectedDm === 'self' ? (
              <div className="flex flex-col h-full w-full">
                {/* Chat Header Bar */}
                <div className="h-12 border-b border-[#18191c] bg-[#18191c] px-4 flex items-center justify-between flex-shrink-0 shadow-xs z-10">
                  <div className="flex items-center gap-3">
                    <span className="text-[#949ba4] font-bold text-[18px]">@</span>
                    <span className="font-bold text-white text-[15px]">{currentDisplayName}</span>
                    <div
                      className={`w-2.5 h-2.5 rounded-full ${STATUS_CONFIG[userStatus].bgClass}`}
                      title={STATUS_CONFIG[userStatus].label}
                    />
                    <span className="text-[12px] text-[#949ba4]">{STATUS_CONFIG[userStatus].label}</span>
                  </div>

                  {/* Profile Toggle button on top-right */}
                  <button
                    type="button"
                    onClick={() => setShowProfilePanel(!showProfilePanel)}
                    className={`p-1.5 rounded-[4px] transition-colors cursor-pointer ${
                      showProfilePanel
                        ? 'text-white bg-[#2b2d31]'
                        : 'text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#232428]'
                    }`}
                    title={showProfilePanel ? 'Hide User Profile' : 'Show User Profile'}
                  >
                    <User className="w-5 h-5" />
                  </button>
                </div>

                {/* Chat & Profile Main Area below header */}
                <div className="flex-1 flex min-h-0 relative overflow-hidden">
                  <div
                    className={`flex-1 flex flex-col min-h-0 min-w-0 transition-[margin] duration-200 ease-out ${
                      showProfilePanel ? 'mr-[326px]' : 'mr-0'
                    }`}
                  >
                    {/* Chat Messages Scrollable History */}
                    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
                      {/* Beginning of self-DM introduction */}
                      <div className="mb-8 select-none">
                        <div className="w-20 h-20 rounded-full bg-[#18191c] overflow-hidden flex items-center justify-center text-white ring-4 ring-[#232428] mb-3">
                          {avatarPreview ? (
                            <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-10 h-10 text-[#ff6b00]" />
                          )}
                        </div>
                        <h2 className="text-3xl font-bold text-white mb-1.5">{currentDisplayName}</h2>
                        <p className="text-[#dbdee1] text-[16px] font-medium mb-1">
                          This is the start of your direct message history with yourself.
                        </p>
                        <p className="text-[#949ba4] text-[14px]">
                          This is your personal space. You can write notes to yourself, save links, or test message formatting.
                        </p>
                        <div className="h-[1px] bg-[#232428] mt-6" />
                      </div>

                      {/* Rendered self messages */}
                      {displayedSelfMessages.map((msg) => (
                        <ChatMessageItem
                          key={msg.id}
                          msg={msg}
                          currentUsername={currentUsername}
                          location="self"
                          onReply={(m) => setReplyTarget({ message: m, location: 'self' })}
                          onDelete={(m) => handleDeleteMessage(m, 'self')}
                          onToggleReaction={(m, emoji) => handleToggleReaction(m, emoji, 'self')}
                          onImageClick={(url) => setPreviewImageUrl(url)}
                        />
                      ))}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Chat Input Bar */}
                    <div className="px-4 pb-6 pt-2 bg-[#111214] flex-shrink-0 relative">
                      {/* Mention Autocomplete Popover */}
                      {mentionState && mentionState.isOpen && mentionState.target === 'dm' && (
                        <MentionAutocomplete
                          candidates={mentionState.candidates}
                          selectedIndex={mentionState.selectedIndex}
                          onSelect={handleSelectMention}
                        />
                      )}

                      {/* Replying banner */}
                      {replyTarget && (replyTarget.location === 'self' || replyTarget.location === 'dm') && (
                        <div className="bg-[#18191c] border-t border-l border-r border-[#232428] rounded-t-[8px] px-3.5 py-1.5 flex items-center justify-between text-[12px] text-[#949ba4]">
                          <div className="flex items-center gap-2 truncate">
                            <Reply className="w-3.5 h-3.5 text-[#ff6b00] flex-shrink-0" />
                            <span>Replying to</span>
                            <span className="font-semibold text-white">
                              @{replyTarget.message.authorDisplayName || replyTarget.message.authorUsername}
                            </span>
                            {replyTarget.message.text && (
                              <span className="truncate max-w-xs text-[#80848e]">
                                "{replyTarget.message.text}"
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setReplyTarget(null)}
                            className="p-1 text-[#949ba4] hover:text-white rounded-[3px] cursor-pointer"
                            title="Cancel reply"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Attachment Preview Banner */}
                      {dmAttachment && (
                        <div className="bg-[#18191c] border-t border-l border-r border-[#232428] rounded-t-[8px] p-2.5 flex items-center gap-3">
                          <div className="w-12 h-12 rounded-[4px] overflow-hidden bg-black/40 border border-[#2b2d31] flex items-center justify-center flex-shrink-0">
                            <img src={dmAttachment.previewUrl} alt="Preview" className="w-full h-full object-cover" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] font-medium text-white truncate">{dmAttachment.name}</div>
                            <div className="text-[11px] text-[#ff6b00]">Image / GIF ready to upload</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setDmAttachment(null)}
                            className="p-1 rounded-full bg-[#2b2d31] hover:bg-[#35373c] text-[#949ba4] hover:text-white cursor-pointer mr-2"
                            title="Remove attachment"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      <form
                        onSubmit={handleSendDmMessage}
                        className={`bg-[#1e1f22] border border-transparent focus-within:border-[#ff6b00]/40 flex items-center px-4 py-2.5 transition-colors ${
                          replyTarget || dmAttachment ? 'rounded-b-[8px]' : 'rounded-[8px]'
                        }`}
                      >
                        {/* Plus button for file upload */}
                        <button
                          type="button"
                          onClick={() => dmFileInputRef.current?.click()}
                          className="w-6 h-6 rounded-full bg-[#2b2d31] hover:bg-[#35373c] text-[#949ba4] hover:text-white flex items-center justify-center transition-colors cursor-pointer flex-shrink-0 mr-3"
                          title="Upload Image or GIF (no MP4)"
                        >
                          <Plus className="w-4 h-4 stroke-[2.5]" />
                        </button>

                        {/* Input field */}
                        <input
                          ref={dmInputRef}
                          type="text"
                          value={chatInput}
                          onChange={(e) => handleDmInputChange(e.target.value, e.target.selectionStart ?? undefined)}
                          onKeyDown={(e) => handleInputKeyDown(e, 'dm')}
                          placeholder={`Message @${currentDisplayName}`}
                          className="bg-transparent text-white placeholder-[#949ba4] text-[15px] outline-none flex-1 pr-3"
                        />

                        {/* Right actions: Emoji & Send */}
                        <div className="flex items-center gap-2 text-[#949ba4]">
                          <button
                            type="button"
                            onClick={() => setChatInput((prev) => prev + ' 😊')}
                            className="hover:text-white transition-colors cursor-pointer p-1"
                            title="Insert Emoji"
                          >
                            <Smile className="w-5 h-5" />
                          </button>
                          {(chatInput.trim() || dmAttachment) && (
                            <button
                              type="submit"
                              disabled={isUploadingAttachment}
                              className="p-1 text-[#ff6b00] hover:text-[#e55b00] disabled:opacity-50 transition-colors cursor-pointer"
                              title="Send Message"
                            >
                              {isUploadingAttachment ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Send className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </div>
                      </form>
                    </div>
                  </div>

                  {/* OVERLAPPING USER PROFILE ON THE RIGHT */}
                  {showProfilePanel && (
                    <div className="absolute right-4 top-2 bottom-4 w-[310px] max-w-[calc(100vw-360px)] bg-[#18191c] border border-[#232428] rounded-[8px] shadow-2xl flex flex-col overflow-hidden z-20 animate-in fade-in duration-150 select-none">
                      <div className="relative flex-shrink-0">
                        <div className="h-28 bg-[#1f2023] overflow-hidden relative">
                          {bannerPreview ? (
                            <img src={bannerPreview} alt="Profile Banner" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-[#232428]" />
                          )}
                          <button
                            type="button"
                            onClick={() => setShowProfilePanel(false)}
                            className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 text-[#dbdee1] hover:text-white flex items-center justify-center transition-colors cursor-pointer z-30"
                            title="Close panel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="absolute left-4 -bottom-10 z-30 pointer-events-auto">
                          <div className="relative">
                            <div className="w-20 h-20 rounded-full bg-[#111214] ring-[6px] ring-[#18191c] overflow-hidden flex items-center justify-center text-white shadow-2xl">
                              {avatarPreview ? (
                                <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                              ) : (
                                <User className="w-10 h-10 text-[#dbdee1]" />
                              )}
                            </div>
                            <div
                              className={`absolute bottom-0.5 right-0.5 w-5 h-5 rounded-full border-4 border-[#18191c] z-40 ${
                                STATUS_CONFIG[userStatus].bgClass
                              }`}
                              title={STATUS_CONFIG[userStatus].label}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="pt-12 px-4 pb-4 relative z-10 flex-1 overflow-y-auto">
                        <div className="mb-3">
                          <h3 className="text-white font-bold text-[18px] leading-tight truncate">
                            {currentDisplayName}
                          </h3>
                          <div className="text-[#949ba4] text-[13px] flex items-center gap-1.5 mt-1 font-normal">
                            <span>{currentUsername}</span>
                            {pronouns && (
                              <>
                                <span className="text-[#949ba4]">•</span>
                                <span className="text-[#dbdee1]">{pronouns}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="h-[1px] bg-[#232428] my-3.5" />

                        <div className="mb-4">
                          <div className="text-[12px] font-bold text-[#b5bac1] uppercase tracking-wider mb-1.5">
                            About Me
                          </div>
                          <p className="text-[13px] text-[#dbdee1] leading-relaxed whitespace-pre-wrap">
                            {aboutMe || 'Hey there! Using Yapzo.'}
                          </p>
                        </div>

                        <div className="mb-4">
                          <div className="text-[12px] font-bold text-[#b5bac1] uppercase tracking-wider mb-1">
                            Member Since
                          </div>
                          <p className="text-[13px] text-[#dbdee1]">
                            Oct 24, 2026
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* FRIEND 1-ON-1 DIRECT MESSAGE CHAT */
              (() => {
                const targetUserProfile: UserProfile =
                  allUsers.find((u) => u.username.toLowerCase() === selectedDm.toLowerCase()) || {
                    id: selectedFriend?.id || selectedDm.toLowerCase(),
                    username: selectedFriend?.username || selectedDm,
                    displayName: selectedFriend?.displayName || selectedDm,
                    email: '',
                    avatar: selectedFriend?.avatar || null,
                    banner: null,
                    pronouns: '',
                    aboutMe: selectedFriend?.aboutMe || '',
                    status: selectedFriend?.status || 'offline',
                    isMuted: false,
                    isDeafened: false,
                    createdAt: selectedFriend?.addedAt || Date.now(),
                    lastSeen: selectedFriend?.addedAt || Date.now()
                  };
                const statusInfo = STATUS_CONFIG[targetUserProfile.status || 'offline'] || STATUS_CONFIG.offline;

                return (
                  <div className="flex flex-col h-full w-full">
                    {/* Chat Header Bar */}
                    <div className="h-12 border-b border-[#18191c] bg-[#18191c] px-4 flex items-center justify-between flex-shrink-0 shadow-xs z-10">
                      <div className="flex items-center gap-3">
                        <span className="text-[#949ba4] font-bold text-[18px]">@</span>
                        <span className="font-bold text-white text-[15px]">
                          {targetUserProfile.displayName || targetUserProfile.username}
                        </span>
                        <div
                          className={`w-2.5 h-2.5 rounded-full ${statusInfo.bgClass}`}
                          title={statusInfo.label}
                        />
                        <span className="text-[12px] text-[#949ba4]">{statusInfo.label}</span>
                      </div>

                      {/* Profile Toggle button on top-right */}
                      <button
                        type="button"
                        onClick={() => setShowProfilePanel(!showProfilePanel)}
                        className={`p-1.5 rounded-[4px] transition-colors cursor-pointer ${
                          showProfilePanel
                            ? 'text-white bg-[#2b2d31]'
                            : 'text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#232428]'
                        }`}
                        title={showProfilePanel ? 'Hide User Profile' : 'Show User Profile'}
                      >
                        <User className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Chat & Profile Main Area below header */}
                    <div className="flex-1 flex min-h-0 relative overflow-hidden">
                      <div
                        className={`flex-1 flex flex-col min-h-0 min-w-0 transition-[margin] duration-200 ease-out ${
                          showProfilePanel ? 'mr-[326px]' : 'mr-0'
                        }`}
                      >
                        {/* Messages history + Input */}
                        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
                          {/* Beginning of conversation banner */}
                          <div className="mb-8 select-none">
                            <div className="w-20 h-20 rounded-full bg-[#18191c] overflow-hidden flex items-center justify-center text-white ring-4 ring-[#232428] mb-3">
                              {targetUserProfile.avatar ? (
                                <img src={targetUserProfile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                              ) : (
                                <User className="w-10 h-10 text-[#ff6b00]" />
                              )}
                            </div>
                            <h2 className="text-3xl font-bold text-white mb-1.5">
                              {targetUserProfile.displayName || targetUserProfile.username}
                            </h2>
                            <p className="text-[#dbdee1] text-[16px] font-medium mb-1">
                              This is the beginning of your direct message history with @{targetUserProfile.username}.
                            </p>
                            <p className="text-[#949ba4] text-[14px]">
                              Say hello and start yapping!
                            </p>
                            <div className="h-[1px] bg-[#232428] mt-6" />
                          </div>

                          {/* Messages in this DM */}
                          {displayedDmMessages.map((msg) => (
                            <ChatMessageItem
                              key={msg.id}
                              msg={msg}
                              currentUsername={currentUsername}
                              location="dm"
                              onReply={(m) => setReplyTarget({ message: m, location: 'dm' })}
                              onDelete={(m) => handleDeleteMessage(m, 'dm')}
                              onToggleReaction={(m, emoji) => handleToggleReaction(m, emoji, 'dm')}
                              onImageClick={(url) => setPreviewImageUrl(url)}
                              onAuthorClick={(authorUsername) => {
                                const u = allUsers.find(
                                  (user) => user.username.toLowerCase() === authorUsername.toLowerCase()
                                );
                                if (u) {
                                  const isCurrent = u.username.toLowerCase() === currentUsername.toLowerCase();
                                  setSelectedServerMember(
                                    isCurrent
                                      ? {
                                          ...u,
                                          displayName: currentDisplayName,
                                          avatar: avatarPreview,
                                          banner: bannerPreview,
                                          status: userStatus,
                                          aboutMe,
                                          pronouns
                                        }
                                      : u
                                  );
                                  setShowMemberMoreMenu(false);
                                  setMemberModalFeedback(null);
                                }
                              }}
                            />
                          ))}
                          <div ref={dmChatMessagesEndRef} />
                        </div>

                        {/* Chat Input Bar */}
                        <div className="px-4 pb-6 pt-2 bg-[#111214] flex-shrink-0 relative">
                          {/* Mention Autocomplete Popover */}
                          {mentionState && mentionState.isOpen && mentionState.target === 'dm' && (
                            <MentionAutocomplete
                              candidates={mentionState.candidates}
                              selectedIndex={mentionState.selectedIndex}
                              onSelect={handleSelectMention}
                            />
                          )}

                          {/* Replying banner */}
                          {replyTarget && replyTarget.location === 'dm' && (
                            <div className="bg-[#18191c] border-t border-l border-r border-[#232428] rounded-t-[8px] px-3.5 py-1.5 flex items-center justify-between text-[12px] text-[#949ba4]">
                              <div className="flex items-center gap-2 truncate">
                                <Reply className="w-3.5 h-3.5 text-[#ff6b00] flex-shrink-0" />
                                <span>Replying to</span>
                                <span className="font-semibold text-white">
                                  @{replyTarget.message.authorDisplayName || replyTarget.message.authorUsername}
                                </span>
                                {replyTarget.message.text && (
                                  <span className="truncate max-w-xs text-[#80848e]">
                                    "{replyTarget.message.text}"
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => setReplyTarget(null)}
                                className="p-1 text-[#949ba4] hover:text-white rounded-[3px] cursor-pointer"
                                title="Cancel reply"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}

                          {/* Attachment Preview Banner */}
                          {dmAttachment && (
                            <div className="bg-[#18191c] border-t border-l border-r border-[#232428] rounded-t-[8px] p-2.5 flex items-center gap-3">
                              <div className="w-12 h-12 rounded-[4px] overflow-hidden bg-black/40 border border-[#2b2d31] flex items-center justify-center flex-shrink-0">
                                <img src={dmAttachment.previewUrl} alt="Preview" className="w-full h-full object-cover" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-[13px] font-medium text-white truncate">{dmAttachment.name}</div>
                                <div className="text-[11px] text-[#ff6b00]">Image / GIF ready to upload</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setDmAttachment(null)}
                                className="p-1 rounded-full bg-[#2b2d31] hover:bg-[#35373c] text-[#949ba4] hover:text-white cursor-pointer mr-2"
                                title="Remove attachment"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          )}

                          {/* Typing indicator above the input box */}
                          {dmTypingUsers.length > 0 && (
                            <div className="mb-1">
                              <TypingIndicator typingUsers={dmTypingUsers} />
                            </div>
                          )}

                          <form
                            onSubmit={handleSendDmMessage}
                            className={`bg-[#1e1f22] border border-transparent focus-within:border-[#ff6b00]/40 flex items-center px-4 py-2.5 transition-colors ${
                              replyTarget || dmAttachment ? 'rounded-b-[8px]' : 'rounded-[8px]'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => dmFileInputRef.current?.click()}
                              className="w-6 h-6 rounded-full bg-[#2b2d31] hover:bg-[#35373c] text-[#949ba4] hover:text-white flex items-center justify-center transition-colors cursor-pointer flex-shrink-0 mr-3"
                              title="Upload Image or GIF (no MP4)"
                            >
                              <Plus className="w-4 h-4 stroke-[2.5]" />
                            </button>

                            <input
                              ref={dmInputRef}
                              type="text"
                              value={chatInput}
                              onChange={(e) => handleDmInputChange(e.target.value, e.target.selectionStart ?? undefined)}
                              onKeyDown={(e) => handleInputKeyDown(e, 'dm')}
                              placeholder={`Message @${targetUserProfile.displayName || targetUserProfile.username}`}
                              className="bg-transparent text-white placeholder-[#949ba4] text-[15px] outline-none flex-1 pr-3"
                            />

                            <div className="flex items-center gap-2 text-[#949ba4]">
                              <button
                                type="button"
                                onClick={() => setChatInput((prev) => prev + ' 😊')}
                                className="hover:text-white transition-colors cursor-pointer p-1"
                                title="Insert Emoji"
                              >
                                <Smile className="w-5 h-5" />
                              </button>
                              {(chatInput.trim() || dmAttachment) && (
                                <button
                                  type="submit"
                                  disabled={isUploadingAttachment}
                                  className="p-1 text-[#ff6b00] hover:text-[#e55b00] disabled:opacity-50 transition-colors cursor-pointer"
                                  title="Send Message"
                                >
                                  {isUploadingAttachment ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Send className="w-4 h-4" />
                                  )}
                                </button>
                              )}
                            </div>
                          </form>
                        </div>
                      </div>

                      {/* USER PROFILE CARD ON THE RIGHT */}
                      {showProfilePanel && (
                        <div className="absolute right-4 top-2 bottom-4 w-[310px] max-w-[calc(100vw-360px)] bg-[#18191c] border border-[#232428] rounded-[8px] shadow-2xl flex flex-col overflow-hidden z-20 animate-in fade-in duration-150 select-none">
                          <div className="relative flex-shrink-0">
                            <div className="h-28 bg-[#1f2023] overflow-hidden relative">
                              {targetUserProfile.banner ? (
                                <img src={targetUserProfile.banner} alt="Profile Banner" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-r from-[#232428] to-[#1e1f22]" />
                              )}
                              <button
                                type="button"
                                onClick={() => setShowProfilePanel(false)}
                                className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 text-[#dbdee1] hover:text-white flex items-center justify-center transition-colors cursor-pointer z-30"
                                title="Close panel"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="absolute left-4 -bottom-10 z-30 pointer-events-auto">
                              <div className="relative">
                                <div className="w-20 h-20 rounded-full bg-[#111214] ring-[6px] ring-[#18191c] overflow-hidden flex items-center justify-center text-white shadow-2xl">
                                  {targetUserProfile.avatar ? (
                                    <img src={targetUserProfile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                                  ) : (
                                    <User className="w-10 h-10 text-[#dbdee1]" />
                                  )}
                                </div>
                                <div
                                  className={`absolute bottom-0.5 right-0.5 w-5 h-5 rounded-full border-4 border-[#18191c] z-40 ${statusInfo.bgClass}`}
                                  title={statusInfo.label}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="pt-12 px-4 pb-4 relative z-10 flex-1 overflow-y-auto">
                            <div className="mb-3">
                              <h3 className="text-white font-bold text-[18px] leading-tight truncate">
                                {targetUserProfile.displayName || targetUserProfile.username}
                              </h3>
                              <div className="text-[#949ba4] text-[13px] flex items-center gap-1.5 mt-1 font-normal">
                                <span>@{targetUserProfile.username}</span>
                                {targetUserProfile.pronouns && (
                                  <>
                                    <span className="text-[#949ba4]">•</span>
                                    <span className="text-[#dbdee1]">{targetUserProfile.pronouns}</span>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="h-[1px] bg-[#232428] my-3.5" />

                            <div className="mb-4">
                              <div className="text-[12px] font-bold text-[#b5bac1] uppercase tracking-wider mb-1.5">
                                About Me
                              </div>
                              <p className="text-[13px] text-[#dbdee1] leading-relaxed whitespace-pre-wrap">
                                {targetUserProfile.aboutMe || 'Hey there! Using Yapzo.'}
                              </p>
                            </div>

                            <div className="mb-4">
                              <div className="text-[12px] font-bold text-[#b5bac1] uppercase tracking-wider mb-1">
                                Member Since
                              </div>
                              <p className="text-[13px] text-[#dbdee1]">
                                Oct 24, 2026
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()
            )
          ) : activeServerId === 'yapzo-hq' ? (
            /* YAPZO HQ SERVER VIEW (CHANNELS + REAL PLAYER LIST) */
            <div className="flex flex-col h-full w-full">
              {/* Channel Header Bar */}
              <div className="h-12 border-b border-[#18191c] bg-[#18191c] px-4 flex items-center justify-between flex-shrink-0 shadow-xs z-10">
                <div className="flex items-center min-w-0">
                  <Hash className="w-6 h-6 text-[#80848e] mr-2 flex-shrink-0" />
                  <span className="font-bold text-white text-[16px] mr-3">{activeChannelId}</span>
                  <div className="h-4 w-[1px] bg-[#2b2d31] mx-2 hidden sm:block" />
                  <span className="text-[13px] text-[#949ba4] hidden sm:inline truncate">
                    {YAPZO_HQ_CHANNELS.find((c) => c.id === activeChannelId)?.description ||
                      `Welcome to #${activeChannelId}!`}
                  </span>
                </div>

                {/* Right: Player list toggle button */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPlayerList(!showPlayerList)}
                    className={`p-1.5 rounded-[4px] transition-colors cursor-pointer ${
                      showPlayerList
                        ? 'text-white bg-[#2b2d31]'
                        : 'text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#232428]'
                    }`}
                    title={showPlayerList ? 'Hide Player List' : 'Show Player List'}
                  >
                    <Users className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Channel Content: Chat Area + Player List */}
              <div className="flex-1 flex min-h-0 relative overflow-hidden">
                {/* Chat Messages + Input Column */}
                <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-[#111214]">
                  {/* Scrollable messages container */}
                  <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
                    {/* Channel Start Banner */}
                    <div className="mb-6 select-none">
                      <div className="w-16 h-16 rounded-full bg-[#232428] flex items-center justify-center text-white mb-3">
                        <Hash className="w-8 h-8 text-white" />
                      </div>
                      <h2 className="text-3xl font-bold text-white mb-1.5">
                        Welcome to #{activeChannelId}!
                      </h2>
                      <p className="text-[#949ba4] text-[15px]">
                        {YAPZO_HQ_CHANNELS.find((c) => c.id === activeChannelId)?.description ||
                          `This is the start of the #${activeChannelId} channel in Yapzo HQ.`}
                      </p>
                      <div className="h-[1px] bg-[#232428] mt-6" />
                    </div>

                    {/* Rendered messages in this channel */}
                    {(channelMessages[activeChannelId] || []).map((msg) => (
                      <ChatMessageItem
                        key={msg.id}
                        msg={msg}
                        currentUsername={currentUsername}
                        location="channel"
                        onReply={(m) => setReplyTarget({ message: m, location: 'channel' })}
                        onDelete={(m) => handleDeleteMessage(m, 'channel')}
                        onToggleReaction={(m, emoji) => handleToggleReaction(m, emoji, 'channel')}
                        onImageClick={(url) => setPreviewImageUrl(url)}
                        onAuthorClick={(authorUsername) => {
                          const u = allUsers.find(
                            (user) => user.username.toLowerCase() === authorUsername.toLowerCase()
                          );
                          if (u) {
                            const isCurrent = u.username.toLowerCase() === currentUsername.toLowerCase();
                            setSelectedServerMember(
                              isCurrent
                                ? {
                                    ...u,
                                    displayName: currentDisplayName,
                                    avatar: avatarPreview,
                                    banner: bannerPreview,
                                    status: userStatus,
                                    aboutMe,
                                    pronouns
                                  }
                                : u
                            );
                            setShowMemberMoreMenu(false);
                            setMemberModalFeedback(null);
                          }
                        }}
                      />
                    ))}
                    <div ref={channelMessagesEndRef} />
                  </div>

                  {/* Channel Chat Input Bar */}
                  <div className="px-4 pb-6 pt-2 bg-[#111214] flex-shrink-0 relative">
                    {/* Mention Autocomplete Popover */}
                    {mentionState && mentionState.isOpen && mentionState.target === 'channel' && (
                      <MentionAutocomplete
                        candidates={mentionState.candidates}
                        selectedIndex={mentionState.selectedIndex}
                        onSelect={handleSelectMention}
                      />
                    )}

                    {/* Replying banner */}
                    {replyTarget && replyTarget.location === 'channel' && (
                      <div className="bg-[#18191c] border-t border-l border-r border-[#232428] rounded-t-[8px] px-3.5 py-1.5 flex items-center justify-between text-[12px] text-[#949ba4]">
                        <div className="flex items-center gap-2 truncate">
                          <Reply className="w-3.5 h-3.5 text-[#ff6b00] flex-shrink-0" />
                          <span>Replying to</span>
                          <span className="font-semibold text-white">
                            @{replyTarget.message.authorDisplayName || replyTarget.message.authorUsername}
                          </span>
                          {replyTarget.message.text && (
                            <span className="truncate max-w-xs text-[#80848e]">
                              "{replyTarget.message.text}"
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setReplyTarget(null)}
                          className="p-1 text-[#949ba4] hover:text-white rounded-[3px] cursor-pointer"
                          title="Cancel reply"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Attachment Preview Banner */}
                    {channelAttachment && (
                      <div className="bg-[#18191c] border-t border-l border-r border-[#232428] rounded-t-[8px] p-2.5 flex items-center gap-3">
                        <div className="w-12 h-12 rounded-[4px] overflow-hidden bg-black/40 border border-[#2b2d31] flex items-center justify-center flex-shrink-0">
                          <img src={channelAttachment.previewUrl} alt="Preview" className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-medium text-white truncate">{channelAttachment.name}</div>
                          <div className="text-[11px] text-[#ff6b00]">Image / GIF ready to upload</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setChannelAttachment(null)}
                          className="p-1 rounded-full bg-[#2b2d31] hover:bg-[#35373c] text-[#949ba4] hover:text-white cursor-pointer mr-2"
                          title="Remove attachment"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* Typing indicator above the search / message input */}
                    {channelTypingUsers.length > 0 && (
                      <div className="mb-1">
                        <TypingIndicator typingUsers={channelTypingUsers} />
                      </div>
                    )}

                    <form
                      onSubmit={handleSendChannelMessage}
                      className={`bg-[#1e1f22] border border-transparent focus-within:border-[#ff6b00]/40 flex items-center px-4 py-2.5 transition-colors ${
                        replyTarget || channelAttachment ? 'rounded-b-[8px]' : 'rounded-[8px]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => channelFileInputRef.current?.click()}
                        className="w-6 h-6 rounded-full bg-[#2b2d31] hover:bg-[#35373c] text-[#949ba4] hover:text-white flex items-center justify-center transition-colors cursor-pointer flex-shrink-0 mr-3"
                        title="Upload Image or GIF (no MP4)"
                      >
                        <Plus className="w-4 h-4 stroke-[2.5]" />
                      </button>

                      <input
                        ref={channelInputRef}
                        type="text"
                        value={channelChatInput}
                        onChange={(e) => handleChannelInputChange(e.target.value, e.target.selectionStart ?? undefined)}
                        onKeyDown={(e) => handleInputKeyDown(e, 'channel')}
                        placeholder={`Message #${activeChannelId}`}
                        className="bg-transparent text-white placeholder-[#949ba4] text-[15px] outline-none flex-1 pr-3"
                      />

                      <div className="flex items-center gap-2 text-[#949ba4]">
                        <button
                          type="button"
                          onClick={() => setChannelChatInput((prev) => prev + ' 😊')}
                          className="hover:text-white transition-colors cursor-pointer p-1"
                          title="Insert Emoji"
                        >
                          <Smile className="w-5 h-5" />
                        </button>
                        {(channelChatInput.trim() || channelAttachment) && (
                          <button
                            type="submit"
                            disabled={isUploadingAttachment}
                            className="p-1 text-[#ff6b00] hover:text-[#e55b00] disabled:opacity-50 transition-colors cursor-pointer"
                            title="Send Message"
                          >
                            {isUploadingAttachment ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </form>
                  </div>
                </div>

                {/* Player List on the right (Real users from Firestore grouped by Roles) */}
                {showPlayerList && (() => {
                  const userMap = new Map<string, UserProfile>();
                  allUsers.forEach((u) => userMap.set(u.username.toLowerCase(), u));
                  if (currentUsername) {
                    userMap.set(currentUsername.toLowerCase(), {
                      id: currentUsername,
                      username: currentUsername,
                      email: regEmail || loginEmail,
                      displayName: currentDisplayName,
                      avatar: avatarPreview,
                      banner: bannerPreview,
                      pronouns,
                      aboutMe,
                      status: userStatus,
                      isMuted,
                      isDeafened,
                      createdAt: Date.now(),
                      lastSeen: Date.now()
                    });
                  }
                  const mergedList = Array.from(userMap.values());

                  // Helper to resolve a member's effective roles and highest role
                  const getMemberRoleInfo = (u: UserProfile) => {
                    const isCurrent = u.username.toLowerCase() === currentUsername.toLowerCase();
                    const uEmail = (isCurrent ? (regEmail || loginEmail) : u.email) || '';
                    const isUserOwner =
                      uEmail.trim().toLowerCase() === (serverSettings.ownerEmail || 'hayden@gmail.com').trim().toLowerCase() ||
                      u.username.toLowerCase() === 'hayden';

                    const assignedRoleIds = serverSettings.memberRoles?.[u.username.toLowerCase()] || [];
                    const effectiveRoleIds = isUserOwner && !assignedRoleIds.includes('owner')
                      ? ['owner', ...assignedRoleIds]
                      : assignedRoleIds.length === 0 && serverSettings.defaultRoleId && serverSettings.roles[serverSettings.defaultRoleId]
                      ? [serverSettings.defaultRoleId]
                      : assignedRoleIds;

                    const roles = effectiveRoleIds
                      .map((id) => serverSettings.roles[id])
                      .filter(Boolean)
                      .sort((a, b) => (a.position || 99) - (b.position || 99));

                    const highestRole = roles[0] || (serverSettings.defaultRoleId ? serverSettings.roles[serverSettings.defaultRoleId] : null);

                    return {
                      isUserOwner,
                      roles,
                      highestRole
                    };
                  };

                  const memberRoleMap = new Map<string, { isUserOwner: boolean; roles: ServerRole[]; highestRole: ServerRole | null }>();
                  mergedList.forEach((u) => {
                    memberRoleMap.set(u.username.toLowerCase(), getMemberRoleInfo(u));
                  });

                  // Partition into online and offline
                  const onlineMembers = mergedList.filter((u) =>
                    u.username.toLowerCase() === currentUsername.toLowerCase()
                      ? userStatus !== 'offline'
                      : (u.status || 'offline') !== 'offline'
                  );
                  const offlineMembers = mergedList.filter((u) =>
                    u.username.toLowerCase() === currentUsername.toLowerCase()
                      ? userStatus === 'offline'
                      : (u.status || 'offline') === 'offline'
                  );

                  // Hoisted roles sorted by position (e.g. Owner = 1, Admin = 2, etc.)
                  const allRolesSorted = Object.values(serverSettings.roles).sort(
                    (a, b) => (a.position || 99) - (b.position || 99)
                  );
                  const hoistedRoles = allRolesSorted.filter((r) => r.hoist !== false);

                  // Bucket online members by highest hoisted role
                  const roleGroups: { role: ServerRole; members: UserProfile[] }[] = [];
                  const unhoistedOnlineMembers: UserProfile[] = [];

                  hoistedRoles.forEach((role) => {
                    const membersInRole = onlineMembers.filter((u) => {
                      const info = memberRoleMap.get(u.username.toLowerCase());
                      return info?.highestRole?.id === role.id;
                    });
                    if (membersInRole.length > 0) {
                      roleGroups.push({ role, members: membersInRole });
                    }
                  });

                  onlineMembers.forEach((u) => {
                    const info = memberRoleMap.get(u.username.toLowerCase());
                    if (!info?.highestRole || info.highestRole.hoist === false) {
                      unhoistedOnlineMembers.push(u);
                    }
                  });

                  // Render Member Row Helper
                  const renderMemberRow = (u: UserProfile, isOffline = false) => {
                    const isCurrent = u.username.toLowerCase() === currentUsername.toLowerCase();
                    const uStatus = isCurrent ? userStatus : (u.status || 'offline');
                    const uAvatar = isCurrent ? avatarPreview : u.avatar;
                    const uDisplayName = isCurrent ? currentDisplayName : (u.displayName || u.username);
                    const uAboutMe = isCurrent ? aboutMe : u.aboutMe;
                    const info = memberRoleMap.get(u.username.toLowerCase());
                    const nameColor = info?.highestRole?.color || (isOffline ? '#949ba4' : '#ffffff');

                    return (
                      <div
                        key={u.username}
                        onClick={() => {
                          setSelectedServerMember(
                            isCurrent
                              ? {
                                  ...u,
                                  displayName: currentDisplayName,
                                  avatar: avatarPreview,
                                  banner: bannerPreview,
                                  status: userStatus,
                                  aboutMe,
                                  pronouns
                                }
                              : u
                          );
                          setShowMemberMoreMenu(false);
                          setMemberModalFeedback(null);
                        }}
                        className={`flex items-center gap-3 px-2 py-1.5 rounded-[4px] hover:bg-[#232428]/80 cursor-pointer group transition-colors ${
                          isOffline ? 'opacity-60 hover:opacity-100' : ''
                        }`}
                      >
                        <div className="relative flex-shrink-0">
                          <div className="w-8 h-8 rounded-full bg-[#111214] overflow-hidden flex items-center justify-center text-white ring-2 ring-[#232428]">
                            {uAvatar ? (
                              <img src={uAvatar} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-4 h-4 text-[#ff6b00]" />
                            )}
                          </div>
                          <div
                            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#18191c] ${
                              isOffline ? 'bg-[#80848e]' : (STATUS_CONFIG[uStatus]?.bgClass || STATUS_CONFIG.online.bgClass)
                            }`}
                            title={isOffline ? 'Offline' : (STATUS_CONFIG[uStatus]?.label || 'Online')}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="font-semibold text-[14px] leading-tight truncate group-hover:brightness-110"
                              style={{ color: nameColor }}
                            >
                              {uDisplayName}
                            </span>
                            {info?.isUserOwner && (
                              <span title="Server Owner">
                                <Crown className="w-3.5 h-3.5 text-[#f0b232] flex-shrink-0" />
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#949ba4] leading-tight truncate mt-0.5">
                            {uAboutMe || (isOffline ? 'Offline' : (STATUS_CONFIG[uStatus]?.label || 'Online'))}
                          </p>
                        </div>
                      </div>
                    );
                  };

                  return (
                    <aside className="w-60 bg-[#18191c] border-l border-[#111214]/60 flex flex-col flex-shrink-0 p-3 overflow-y-auto select-none">
                      {/* Render each hoisted role section */}
                      {roleGroups.map(({ role, members }) => (
                        <div key={role.id} className="mb-4">
                          <div
                            className="text-[12px] font-bold uppercase tracking-wider px-2 mb-2 flex items-center justify-between"
                            style={{ color: role.color }}
                          >
                            <span>{role.name} — {members.length}</span>
                          </div>
                          <div className="space-y-1">
                            {members.map((u) => renderMemberRow(u, false))}
                          </div>
                        </div>
                      ))}

                      {/* Render unhoisted online members */}
                      {unhoistedOnlineMembers.length > 0 && (
                        <div className="mb-4">
                          <div className="text-[12px] font-bold text-[#949ba4] uppercase tracking-wider px-2 mb-2">
                            Online — {unhoistedOnlineMembers.length}
                          </div>
                          <div className="space-y-1">
                            {unhoistedOnlineMembers.map((u) => renderMemberRow(u, false))}
                          </div>
                        </div>
                      )}

                      {/* Render offline members */}
                      {offlineMembers.length > 0 && (
                        <div>
                          <div className="text-[12px] font-bold text-[#949ba4] uppercase tracking-wider px-2 mb-2">
                            Offline — {offlineMembers.length}
                          </div>
                          <div className="space-y-1">
                            {offlineMembers.map((u) => renderMemberRow(u, true))}
                          </div>
                        </div>
                      )}
                    </aside>
                  );
                })()}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[#949ba4] text-[14px]">
              Select a server or conversation to start chatting
            </div>
          )}
        </main>

        {/* FULLSCREEN DISCORD USER SETTINGS */}
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 bg-[#18191c] text-[#dbdee1] flex animate-in fade-in duration-150 font-['Inter',system-ui,sans-serif] overflow-hidden">
            {/* Settings Left Navigation Sidebar */}
            <aside className="w-60 bg-[#111214] flex flex-col justify-between py-12 px-6 flex-shrink-0 border-r border-[#232428]/60">
              <div className="space-y-1">
                <span className="text-[12px] font-bold text-[#949ba4] tracking-wider uppercase block px-2.5 mb-1.5">
                  User Settings
                </span>
                <button
                  type="button"
                  className="w-full text-left px-2.5 py-1.5 bg-[#232428] text-white font-medium text-[14px] rounded-[4px] flex items-center gap-2 cursor-pointer"
                >
                  <User className="w-4 h-4 text-[#ff6b00]" />
                  <span>Profiles</span>
                </button>
              </div>

              {/* Bottom logout in settings sidebar */}
              <div className="border-t border-[#232428] pt-3">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full text-left px-2.5 py-1.5 text-[#f23f43] hover:bg-[#f23f43]/15 font-medium text-[14px] rounded-[4px] flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out</span>
                </button>
              </div>
            </aside>

            {/* Settings Main Content Area */}
            <div className="flex-1 overflow-y-auto py-12 px-10 relative bg-[#18191c]">
              {/* Iconic Discord ESC Button at top right */}
              <div
                onClick={closeSettings}
                className="fixed top-12 right-12 flex flex-col items-center gap-1 cursor-pointer group z-50 select-none"
                title="Press ESC to close"
              >
                <div className="w-9 h-9 rounded-full border-2 border-[#b5bac1] group-hover:border-white group-hover:bg-[#232428] flex items-center justify-center text-[#b5bac1] group-hover:text-white transition-all">
                  <X className="w-4 h-4 stroke-[2.5]" />
                </div>
                <span className="text-[11px] font-bold text-[#b5bac1] group-hover:text-white tracking-wider">
                  ESC
                </span>
              </div>

              {/* Header */}
              <div className="max-w-[740px] mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">Profiles</h2>
                <div className="flex items-center gap-6 border-b border-[#232428] pb-3">
                  <span className="text-[15px] font-semibold text-white border-b-2 border-[#ff6b00] pb-2 -mb-3">
                    User Profile
                  </span>
                </div>
              </div>

              {/* Main Content: Controls on Left, Live Preview on Right */}
              <div className="max-w-[740px] grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                {/* Left: Input controls */}
                <div className="space-y-6">
                  {/* Display Name */}
                  <div>
                    <label className="block text-[12px] font-bold text-[#b5bac1] uppercase tracking-wider mb-2">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={draftDisplayName}
                      onChange={(e) => setDraftDisplayName(e.target.value)}
                      placeholder="Enter a display name"
                      className="w-full bg-[#111214] text-[#dbdee1] rounded-[3px] px-3 h-10 text-[15px] outline-none border border-transparent focus:border-[#ff6b00] transition-colors"
                    />
                  </div>

                  {/* Pronouns */}
                  <div>
                    <label className="block text-[12px] font-bold text-[#b5bac1] uppercase tracking-wider mb-2">
                      Pronouns
                    </label>
                    <input
                      type="text"
                      value={draftPronouns}
                      onChange={(e) => setDraftPronouns(e.target.value)}
                      placeholder="Add your pronouns (e.g. they/them, she/her)"
                      className="w-full bg-[#111214] text-[#dbdee1] rounded-[3px] px-3 h-10 text-[15px] outline-none border border-transparent focus:border-[#ff6b00] transition-colors"
                    />
                  </div>

                  {/* About Me */}
                  <div>
                    <label className="block text-[12px] font-bold text-[#b5bac1] uppercase tracking-wider mb-2">
                      About Me
                    </label>
                    <textarea
                      value={draftAboutMe}
                      onChange={(e) => setDraftAboutMe(e.target.value)}
                      placeholder="Tell the world a little about yourself"
                      rows={3}
                      maxLength={190}
                      className="w-full bg-[#111214] text-[#dbdee1] rounded-[3px] p-3 text-[14px] outline-none border border-transparent focus:border-[#ff6b00] transition-colors resize-none"
                    />
                  </div>

                  <div className="h-[1px] bg-[#232428] my-4" />

                  {/* Avatar section with Change Avatar */}
                  <div>
                    <label className="block text-[12px] font-bold text-[#b5bac1] uppercase tracking-wider mb-2">
                      Avatar
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => settingsAvatarInputRef.current?.click()}
                        className="px-4 h-9 bg-[#ff6b00] hover:bg-[#e55b00] active:bg-[#cc4e00] text-white font-medium text-[14px] rounded-[3px] transition-colors cursor-pointer flex items-center gap-2"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Change Avatar</span>
                      </button>

                      {draftAvatar && (
                        <button
                          type="button"
                          onClick={() => {
                            setDraftAvatar(null);
                          }}
                          className="px-3 h-9 text-[#f23f43] hover:bg-[#f23f43]/15 font-medium text-[13px] rounded-[3px] transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Banner section with Change Banner */}
                  <div>
                    <label className="block text-[12px] font-bold text-[#b5bac1] uppercase tracking-wider mb-2">
                      Profile Banner
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => settingsBannerInputRef.current?.click()}
                        className="px-4 h-9 bg-[#232428] hover:bg-[#2b2d31] text-white font-medium text-[14px] rounded-[3px] transition-colors cursor-pointer flex items-center gap-2 border border-[#35373c]"
                      >
                        <Upload className="w-4 h-4 text-[#ff6b00]" />
                        <span>Change Banner</span>
                      </button>

                      {draftBanner && (
                        <button
                          type="button"
                          onClick={() => {
                            setDraftBanner(null);
                          }}
                          className="px-3 h-9 text-[#f23f43] hover:bg-[#f23f43]/15 font-medium text-[13px] rounded-[3px] transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Live Discord Profile Preview Card */}
                <div>
                  <label className="block text-[12px] font-bold text-[#b5bac1] uppercase tracking-wider mb-2">
                    Preview
                  </label>
                  <div className="w-[300px] bg-[#111214] rounded-[8px] overflow-hidden border border-[#232428] shadow-2xl select-none">
                    {/* Banner and Avatar Header */}
                    <div className="relative">
                      {/* Banner preview */}
                      <div className="h-28 bg-[#1f2023] relative overflow-hidden flex items-center justify-center">
                        {draftBanner ? (
                          <img
                            src={draftBanner}
                            alt="Banner Preview"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-[#232428]" />
                        )}
                      </div>

                      {/* Avatar preview strictly in front of banner */}
                      <div className="absolute left-4 -bottom-10 z-20">
                        <div className="relative">
                          <div className="w-20 h-20 rounded-full bg-[#18191c] ring-4 ring-[#111214] overflow-hidden flex items-center justify-center text-white shadow-md">
                            {draftAvatar ? (
                              <img
                                src={draftAvatar}
                                alt="Avatar Preview"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <User className="w-8 h-8 text-[#ff6b00]" />
                            )}
                          </div>

                          {/* Online status indicator */}
                          <div
                            className={`absolute bottom-0 right-0 w-5 h-5 rounded-full border-4 border-[#111214] z-30 ${
                              STATUS_CONFIG[userStatus].bgClass
                            }`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Content inside profile preview */}
                    <div className="pt-12 px-4 pb-4 relative">
                      {/* Display name & pronouns in pure text no background */}
                      <div className="bg-[#18191c] p-3.5 rounded-[6px] border border-[#232428]">
                        <h4 className="text-white font-bold text-[18px] leading-snug truncate">
                          {draftDisplayName.trim() || currentUsername}
                        </h4>
                        <div className="text-[#949ba4] text-[13px] flex items-center gap-1.5 mt-0.5 font-normal">
                          <span>{currentUsername}</span>
                          {draftPronouns && (
                            <>
                              <span className="text-[#949ba4]">•</span>
                              <span className="text-[#dbdee1]">{draftPronouns}</span>
                            </>
                          )}
                        </div>

                        <div className="h-[1px] bg-[#232428] my-3" />

                        <div className="mb-3">
                          <span className="font-bold text-[#b5bac1] uppercase tracking-wider block text-[11px] mb-1">
                            About Me
                          </span>
                          <p className="text-[13px] text-[#dbdee1] leading-relaxed whitespace-pre-wrap">
                            {draftAboutMe || 'Hey there! Using Yapzo.'}
                          </p>
                        </div>

                        <div className="text-[12px] text-[#949ba4]">
                          <span className="font-bold text-[#b5bac1] uppercase tracking-wider block text-[11px] mb-1">
                            Member Since
                          </span>
                          <span className="text-[#dbdee1]">Oct 24, 2026</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* FLOATING DISCORD UNSAVED CHANGES NOTICE BAR */}
              {hasUnsavedChanges && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-[660px] bg-[#111214] border border-[#232428] rounded-[6px] px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.85)] flex items-center justify-between gap-4 z-[70] animate-in slide-in-from-bottom-5 duration-200">
                  <span className="text-white text-[14px] font-medium truncate">
                    Careful — you have unsaved changes!
                  </span>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <button
                      type="button"
                      disabled={isSavingSettings}
                      onClick={handleResetSettings}
                      className="text-white hover:underline text-[14px] font-medium px-2 py-1 cursor-pointer transition-all disabled:opacity-50"
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      disabled={isSavingSettings}
                      onClick={handleSaveSettings}
                      className="bg-[#23a55a] hover:bg-[#1f9350] active:bg-[#1a7f45] disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium text-[14px] px-4 py-1.5 rounded-[3px] transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
                    >
                      {isSavingSettings && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      {isSavingSettings ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Hidden file inputs for Settings */}
            <input
              type="file"
              ref={settingsAvatarInputRef}
              onChange={(e) => handleSelectImageForCrop(e, true)}
              accept="image/*"
              className="hidden"
            />
            <input
              type="file"
              ref={settingsBannerInputRef}
              onChange={(e) => handleSelectImageForCrop(e, false)}
              accept="image/*"
              className="hidden"
            />
          </div>
        )}

        {/* FULLSCREEN SERVER SETTINGS MODAL */}
        <ServerSettingsModal
          isOpen={isServerSettingsOpen && canManageServer}
          onClose={() => setIsServerSettingsOpen(false)}
          settings={serverSettings}
          currentUserEmail={regEmail || loginEmail || ''}
          currentUsername={currentUsername}
          allUsers={allUsers}
          onSettingsUpdated={(updated) => setServerSettings(updated)}
        />

        {/* IMAGE RESIZE MODAL */}
        {cropModal && cropModal.isOpen && (
          <ImageCropModal
            imageSrc={cropModal.imageSrc}
            isAvatar={cropModal.isAvatar}
            onCancel={() => setCropModal(null)}
            onApply={handleCropApply}
            isUploading={isUploadingImage}
          />
        )}

        {/* Fullscreen Image / GIF Lightbox Viewer Modal */}
        {previewImageUrl && (
          <div
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-150"
            onClick={() => setPreviewImageUrl(null)}
          >
            <div
              className="relative max-w-5xl max-h-[92vh] flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-full flex items-center justify-end py-2 text-white/80">
                <button
                  type="button"
                  onClick={() => setPreviewImageUrl(null)}
                  className="w-8 h-8 rounded-full bg-[#18191c] hover:bg-[#2b2d31] flex items-center justify-center text-white cursor-pointer transition-colors shadow-md"
                  title="Close (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="rounded-[8px] overflow-hidden shadow-2xl border border-[#232428] bg-[#111214] max-h-[82vh] flex items-center justify-center">
                <img
                  src={previewImageUrl}
                  alt="Full preview"
                  className="max-h-[82vh] max-w-full object-contain select-text"
                />
              </div>
            </div>
          </div>
        )}

        {/* Hidden file inputs for Chat attachments (Images and GIFs only, no MP4) */}
        <input
          type="file"
          ref={channelFileInputRef}
          onChange={(e) => handleFileChange(e, 'channel')}
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
        />
        <input
          type="file"
          ref={dmFileInputRef}
          onChange={(e) => handleFileChange(e, 'dm')}
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
        />

        {/* DM RIGHT-CLICK CONTEXT MENU MODAL */}
        {dmContextMenu && (
          <div
            className="fixed inset-0 z-[100] select-none"
            onClick={() => setDmContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setDmContextMenu(null);
            }}
          >
            <div
              style={{
                left: `${Math.min(dmContextMenu.x, window.innerWidth - 220)}px`,
                top: `${Math.min(dmContextMenu.y, window.innerHeight - 160)}px`
              }}
              className="fixed w-52 bg-[#111214] border border-[#232428] rounded-[8px] shadow-2xl p-1.5 z-[101] animate-in fade-in zoom-in-95 duration-100"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Context Menu Header */}
              <div className="px-2.5 py-2 border-b border-[#232428] mb-1 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-[#18191c] overflow-hidden flex items-center justify-center text-white flex-shrink-0 ring-1 ring-[#232428]">
                  {dmContextMenu.targetAvatar ? (
                    <img src={dmContextMenu.targetAvatar} alt="PFP" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-3.5 h-3.5 text-[#ff6b00]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-white text-[13px] font-bold truncate">{dmContextMenu.targetDisplayName}</p>
                  <p className="text-[#949ba4] text-[11px] truncate">@{dmContextMenu.targetDm}</p>
                </div>
              </div>

              {/* Pin / Unpin Option */}
              <button
                type="button"
                onClick={() => handleTogglePinDm(dmContextMenu.targetDm)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 text-[13px] font-medium text-[#dbdee1] hover:bg-[#ff6b00] hover:text-white rounded-[4px] transition-colors cursor-pointer text-left group"
              >
                {localPinnedDms[dmContextMenu.targetDm.toLowerCase()] ? (
                  <PinOff className="w-4 h-4 text-[#ff6b00] group-hover:text-white" />
                ) : (
                  <Pin className="w-4 h-4 text-[#ff6b00] group-hover:text-white" />
                )}
                <span>{localPinnedDms[dmContextMenu.targetDm.toLowerCase()] ? 'Unpin DM' : 'Pin DM'}</span>
              </button>

              {/* Delete DM Option */}
              <button
                type="button"
                onClick={() => handleDeleteDm(dmContextMenu.targetDm)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 text-[13px] font-medium text-[#f23f43] hover:bg-[#f23f43] hover:text-white rounded-[4px] transition-colors cursor-pointer text-left group"
              >
                <Trash2 className="w-4 h-4 text-[#f23f43] group-hover:text-white" />
                <span>Delete DM</span>
              </button>
            </div>
          </div>
        )}

        {/* CENTER SERVER MEMBER PROFILE MODAL */}
        {selectedServerMember && (() => {
          const isSelf = selectedServerMember.username.toLowerCase() === currentUsername.toLowerCase();
          const isAlreadyFriend = friends.some(
            (f) => f.username.toLowerCase() === selectedServerMember.username.toLowerCase() &&
            (!f.requestStatus || f.requestStatus === 'accepted')
          );
          const isFriendPending = friends.some(
            (f) => f.username.toLowerCase() === selectedServerMember.username.toLowerCase() &&
            f.requestStatus?.startsWith('pending')
          );
          const statusInfo = STATUS_CONFIG[selectedServerMember.status || 'offline'] || STATUS_CONFIG.offline;

          return (
            <div
              className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in duration-150"
              onClick={() => {
                setSelectedServerMember(null);
                setShowMemberMoreMenu(false);
              }}
            >
              <div
                className="w-full max-w-[340px] bg-[#18191c] border border-[#232428] rounded-[12px] shadow-2xl overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Banner Wrapper */}
                <div className="relative flex-shrink-0">
                  <div className="h-28 bg-[#1f2023] overflow-hidden relative">
                    {selectedServerMember.banner ? (
                      <img
                        src={selectedServerMember.banner}
                        alt="Banner"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-r from-[#ff6b00]/20 via-[#232428] to-[#1e1f22]" />
                    )}

                    {/* Top Right Buttons: "..." and Close */}
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-30">
                      {/* "..." More menu button */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowMemberMoreMenu(!showMemberMoreMenu)}
                          className="w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 text-[#dbdee1] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                          title="More options"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>

                        {/* Popup menu with Add Friend option */}
                        {showMemberMoreMenu && (
                          <div
                            className="absolute right-0 top-8.5 w-44 bg-[#111214] border border-[#232428] rounded-[6px] shadow-2xl p-1 z-40 animate-in fade-in zoom-in-95 duration-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              disabled={isSelf || isAlreadyFriend || isFriendPending}
                              onClick={() => handleAddFriendFromModal(selectedServerMember)}
                              className="w-full flex items-center gap-2 px-2.5 py-2 text-[13px] font-medium text-[#dbdee1] hover:bg-[#ff6b00] hover:text-white disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-[#dbdee1] rounded-[4px] transition-colors cursor-pointer text-left group"
                            >
                              <UserPlus className="w-4 h-4 text-[#ff6b00] group-hover:text-white" />
                              <span>
                                {isSelf
                                  ? 'This is you'
                                  : isAlreadyFriend
                                  ? 'Already Friends'
                                  : isFriendPending
                                  ? 'Request Pending'
                                  : 'Add Friend'}
                              </span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Close button */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedServerMember(null);
                          setShowMemberMoreMenu(false);
                        }}
                        className="w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 text-[#dbdee1] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                        title="Close"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Overlapping Avatar - In front of banner and body */}
                  <div className="absolute left-4 -bottom-10 z-30 pointer-events-auto">
                    <div className="relative">
                      <div className="w-20 h-20 rounded-full bg-[#111214] ring-[6px] ring-[#18191c] overflow-hidden flex items-center justify-center text-white shadow-2xl">
                        {selectedServerMember.avatar ? (
                          <img
                            src={selectedServerMember.avatar}
                            alt={selectedServerMember.displayName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-10 h-10 text-[#dbdee1]" />
                        )}
                      </div>
                      <div
                        className={`absolute bottom-0.5 right-0.5 w-5 h-5 rounded-full border-4 border-[#18191c] z-40 ${statusInfo.bgClass}`}
                        title={statusInfo.label}
                      />
                    </div>
                  </div>
                </div>

                {/* Content details */}
                <div className="pt-12 px-4 pb-4 relative z-10 flex-1 flex flex-col">
                  <div className="mb-3">
                    <h3 className="text-white font-bold text-[18px] leading-tight truncate">
                      {selectedServerMember.displayName || selectedServerMember.username}
                    </h3>
                    <div className="text-[#949ba4] text-[13px] flex items-center gap-1.5 mt-1 font-normal">
                      <span>@{selectedServerMember.username}</span>
                      {selectedServerMember.pronouns && (
                        <>
                          <span className="text-[#949ba4]">•</span>
                          <span className="text-[#dbdee1]">{selectedServerMember.pronouns}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Toast feedback if Add Friend was clicked */}
                  {memberModalFeedback && (
                    <div className="mb-3 p-2 rounded-[4px] bg-[#23a55a]/15 border border-[#23a55a]/40 text-[#2ecc71] text-[12px] flex items-center gap-1.5 animate-in fade-in duration-150">
                      <Check className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{memberModalFeedback}</span>
                    </div>
                  )}

                  <div className="h-[1px] bg-[#232428] my-2" />

                  {/* About Me */}
                  <div className="mb-3">
                    <div className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider mb-1">
                      About Me
                    </div>
                    <p className="text-[13px] text-[#dbdee1] leading-relaxed whitespace-pre-wrap">
                      {selectedServerMember.aboutMe || 'Hey there! Using Yapzo.'}
                    </p>
                  </div>

                  {/* Member Since */}
                  <div className="mb-4">
                    <div className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider mb-1">
                      Member Since
                    </div>
                    <p className="text-[13px] text-[#dbdee1]">
                      Oct 24, 2026
                    </p>
                  </div>

                  {/* Bottom Action: Message button */}
                  <div className="mt-auto pt-2">
                    {!isSelf ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedServerMember(null);
                          setShowMemberMoreMenu(false);
                          handleOpenUserDm(selectedServerMember.username);
                        }}
                        className="w-full py-2.5 px-4 bg-[#ff6b00] hover:bg-[#e55b00] text-white font-semibold text-[14px] rounded-[6px] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md hover:shadow-[0_0_12px_rgba(255,107,0,0.35)]"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>Message</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedServerMember(null);
                          setShowMemberMoreMenu(false);
                          openSettings();
                        }}
                        className="w-full py-2.5 px-4 bg-[#2b2d31] hover:bg-[#35373c] text-white font-medium text-[14px] rounded-[6px] transition-colors flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Settings className="w-4 h-4 text-[#ff6b00]" />
                        <span>Edit Profile</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  // SCREEN: INFINITE LOADING SCREEN WITH MASCOT LOGO AND DISCORD-STYLE TIPS
  if (screen === 'loading') {
    return (
      <div className="min-h-screen w-full bg-black flex flex-col items-center justify-center p-6 select-none relative overflow-hidden">
        {/* Centered Mascot Logo with subtle Discord breathing pulse */}
        <div className="flex flex-col items-center">
          <div className="w-28 h-28 md:w-32 md:h-32 flex items-center justify-center animate-[discordPulse_2.4s_ease-in-out_infinite]">
            {transparentLogoUrl ? (
              <img
                src={transparentLogoUrl}
                alt="Yapzo"
                className="w-full h-full object-contain filter drop-shadow-[0_0_24px_rgba(255,107,0,0.22)]"
              />
            ) : (
              <img
                src="/logo.png"
                alt="Yapzo"
                className="w-full h-full object-contain opacity-0"
              />
            )}
          </div>

          {/* Did You Know & Discord Tips */}
          <div className="mt-8 flex flex-col items-center text-center max-w-[460px]">
            <span className="text-[#ff6b00] font-bold text-[12px] tracking-[0.18em] uppercase mb-1.5">
              Did you know
            </span>
            <p
              className={`text-[#949ba4] text-[15px] font-normal leading-relaxed min-h-[46px] transition-opacity duration-300 ${
                tipOpacity ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {DISCORD_TIPS[currentTipIndex]}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // STEP 1 - 2: CHOOSE PFP AND BANNER
  if (screen === 'step1') {
    return (
      <div className="min-h-screen w-full bg-black flex items-center justify-center p-4">
        <div className="w-full max-w-[480px] bg-[#18191c] rounded-[5px] p-8 shadow-[0_2px_10px_0_rgba(0,0,0,0.6)] border border-[#232428]">
          {/* Header */}
          <div className="text-center mb-6">
            <span className="text-[#ff6b00] font-bold text-[12px] tracking-widest uppercase block mb-1">
              Step 1 — 2
            </span>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Choose your look
            </h1>
            <p className="text-[#949ba4] text-[14px] mt-1.5">
              Choose your profile picture and banner. Click either to upload.
            </p>
          </div>

          {/* Hidden file inputs */}
          <input
            type="file"
            ref={bannerInputRef}
            onChange={(e) => handleSelectImageForCrop(e, false)}
            accept="image/*"
            className="hidden"
          />
          <input
            type="file"
            ref={avatarInputRef}
            onChange={(e) => handleSelectImageForCrop(e, true)}
            accept="image/*"
            className="hidden"
          />

          {/* Profile Card Preview */}
          <div className="bg-[#111214] rounded-[6px] border border-[#232428] overflow-hidden mb-6">
            {/* Banner Area */}
            <div
              onClick={() => bannerInputRef.current?.click()}
              className="relative h-28 bg-[#1f2023] cursor-pointer group flex items-center justify-center overflow-hidden border-b border-[#232428] transition-colors hover:bg-[#25272a]"
            >
              {bannerPreview ? (
                <img
                  src={bannerPreview}
                  alt="Profile Banner"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-1.5 text-[#949ba4] group-hover:text-white transition-colors">
                  <Camera className="w-5 h-5 text-[#ff6b00]" />
                  <span className="text-[12px] font-medium tracking-wide">
                    Click to upload banner
                  </span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 text-white text-[12px] font-medium transition-opacity">
                <Upload className="w-4 h-4 text-[#ff6b00]" /> Change Banner
              </div>
            </div>

            {/* Profile Content Details */}
            <div className="px-5 pb-5 pt-0 relative">
              {/* Avatar circle overlapping banner */}
              <div className="relative -mt-10 mb-3 inline-block">
                <div
                  onClick={() => avatarInputRef.current?.click()}
                  className="w-20 h-20 rounded-full bg-[#18191c] ring-4 ring-[#111214] overflow-hidden cursor-pointer group relative flex items-center justify-center"
                >
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center w-full h-full bg-[#2b2d31] text-[#949ba4] group-hover:text-white transition-colors">
                      <Camera className="w-6 h-6 text-[#ff6b00]" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-medium transition-opacity text-center px-1">
                    Upload PFP
                  </div>
                </div>
              </div>

              {/* Names */}
              <div>
                <h3 className="text-white font-bold text-[18px] leading-tight">
                  {regDisplayName.trim() || regUsername.trim() || 'New Member'}
                </h3>
                <p className="text-[#949ba4] text-[13px] mt-0.5">
                  @{regUsername.trim() || 'username'}
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => setScreen('step2')}
              className="w-full h-11 bg-[#ff6b00] hover:bg-[#e55b00] active:bg-[#cc4e00] text-white font-medium text-[16px] rounded-[3px] transition-colors cursor-pointer"
            >
              Next
            </button>
            <button
              type="button"
              onClick={() => setScreen('auth')}
              className="w-full py-2 text-[#949ba4] hover:text-white text-[14px] font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Account Details
            </button>
          </div>
        </div>

        {/* CROP MODAL IN STEP 1 IF TRIGGERED */}
        {cropModal && cropModal.isOpen && (
          <ImageCropModal
            imageSrc={cropModal.imageSrc}
            isAvatar={cropModal.isAvatar}
            onCancel={() => setCropModal(null)}
            onApply={handleCropApply}
            isUploading={isUploadingImage}
          />
        )}
      </div>
    );
  }

  // STEP 2 - 2: TERMS OF SERVICE BIG LIST & REQUIRED CHECKBOXES
  if (screen === 'step2') {
    return (
      <div className="min-h-screen w-full bg-black flex items-center justify-center p-4">
        <div className="w-full max-w-[540px] bg-[#18191c] rounded-[5px] p-8 shadow-[0_2px_10px_0_rgba(0,0,0,0.6)] border border-[#232428]">
          {/* Header */}
          <div className="text-center mb-5">
            <span className="text-[#ff6b00] font-bold text-[12px] tracking-widest uppercase block mb-1">
              Step 2 — 2
            </span>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Terms of Service
            </h1>
            <p className="text-[#949ba4] text-[14px] mt-1.5">
              Please read through our terms and accept the agreements below to finish signup.
            </p>
          </div>

          {/* Big List of Terms of Service */}
          <div className="bg-[#111214] border border-[#232428] rounded-[4px] p-4 max-h-[260px] overflow-y-auto text-[#dbdee1] text-[13px] leading-relaxed space-y-4 mb-5 scrollbar-thin">
            <section>
              <h4 className="text-white font-semibold text-[14px] mb-1">
                1. Acceptance of Terms
              </h4>
              <p className="text-[#949ba4]">
                By registering for Yapzo, you confirm that you have read, understood, and agreed to be legally bound by these Terms of Service and Community Guidelines. If you do not accept these terms in full, you may not access or use Yapzo.
              </p>
            </section>

            <section>
              <h4 className="text-white font-semibold text-[14px] mb-1">
                2. Age Requirement &amp; Eligibility
              </h4>
              <p className="text-[#949ba4]">
                You must be at least 13 years of age, or the minimum legal age required in your jurisdiction, to create an account. Providing fraudulent age data during registration is grounds for immediate account suspension.
              </p>
            </section>

            <section>
              <h4 className="text-white font-semibold text-[14px] mb-1">
                3. Respectful Communication &amp; Zero Tolerance
              </h4>
              <p className="text-[#949ba4]">
                Yapzo maintains strict zero-tolerance policies against harassment, hate speech, bullying, doxing, non-consensual media sharing, and coordinated attacks. Users engaging in such conduct will have their accounts banned permanently.
              </p>
            </section>

            <section>
              <h4 className="text-white font-semibold text-[14px] mb-1">
                4. Voice &amp; Chat Channel Conduct
              </h4>
              <p className="text-[#949ba4]">
                You agree not to disrupt voice channels with soundboards, unauthorized scraping bots, or ear-rape audio. Screen sharing copyrighted material without authorization or transmitting malware is strictly forbidden.
              </p>
            </section>

            <section>
              <h4 className="text-white font-semibold text-[14px] mb-1">
                5. Account Security
              </h4>
              <p className="text-[#949ba4]">
                You are responsible for keeping your login credentials confidential. Yapzo staff will never ask for your password. Any activity originating from your account is your sole legal responsibility.
              </p>
            </section>

            <section>
              <h4 className="text-white font-semibold text-[14px] mb-1">
                6. Automated Scraping &amp; Raiding
              </h4>
              <p className="text-[#949ba4]">
                Automated token scraping, user raiding, spamming direct messages, and utilizing self-bots that bypass our client limits violate Yapzo engineering integrity and will trigger immediate IP termination.
              </p>
            </section>

            <section>
              <h4 className="text-white font-semibold text-[14px] mb-1">
                7. Content Ownership &amp; Licensing
              </h4>
              <p className="text-[#949ba4]">
                You retain ownership of the text and media you share. By submitting content through Yapzo, you grant us the technical license necessary to host, encode, and transmit your data to your selected recipients.
              </p>
            </section>

            <section>
              <h4 className="text-white font-semibold text-[14px] mb-1">
                8. Enforcement &amp; Termination
              </h4>
              <p className="text-[#949ba4]">
                Yapzo moderators reserve the right to review reported content, apply temporary timeouts, delete offensive servers, or permanently terminate any account that violates platform standards.
              </p>
            </section>
          </div>

          {/* Checkboxes at the bottom */}
          <div className="space-y-3 mb-6">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-5 h-5 min-w-[20px] rounded-[4px] border border-[#4e5058] bg-[#111214] peer-checked:bg-[#ff6b00] peer-checked:border-[#ff6b00] flex items-center justify-center transition-colors mt-0.5">
                {agreeTerms && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
              </div>
              <span className="text-[13px] text-[#dbdee1] leading-tight">
                I have read and agree to all provisions of the Yapzo Terms of Service. <span className="text-[#ff6b00]">*</span>
              </span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreeGuidelines}
                onChange={(e) => setAgreeGuidelines(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-5 h-5 min-w-[20px] rounded-[4px] border border-[#4e5058] bg-[#111214] peer-checked:bg-[#ff6b00] peer-checked:border-[#ff6b00] flex items-center justify-center transition-colors mt-0.5">
                {agreeGuidelines && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
              </div>
              <span className="text-[13px] text-[#dbdee1] leading-tight">
                I agree to adhere to the Community Guidelines and uphold respectful communication. <span className="text-[#ff6b00]">*</span>
              </span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreeRules}
                onChange={(e) => setAgreeRules(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-5 h-5 min-w-[20px] rounded-[4px] border border-[#4e5058] bg-[#111214] peer-checked:bg-[#ff6b00] peer-checked:border-[#ff6b00] flex items-center justify-center transition-colors mt-0.5">
                {agreeRules && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
              </div>
              <span className="text-[13px] text-[#dbdee1] leading-tight">
                I acknowledge that harassment, raids, or hate speech will result in immediate permanent account termination. <span className="text-[#ff6b00]">*</span>
              </span>
            </label>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              disabled={!allAgreed || isRegistering}
              onClick={handleFinishRegistration}
              className={`w-full h-11 font-medium text-[16px] rounded-[3px] transition-colors flex items-center justify-center gap-2 ${
                allAgreed && !isRegistering
                  ? 'bg-[#ff6b00] hover:bg-[#e55b00] active:bg-[#cc4e00] text-white cursor-pointer'
                  : 'bg-[#ff6b00]/30 text-white/40 cursor-not-allowed'
              }`}
            >
              {isRegistering && <Loader2 className="w-5 h-5 animate-spin" />}
              {isRegistering ? 'Creating Account & Saving...' : 'Done'}
            </button>
            <button
              type="button"
              onClick={() => setScreen('step1')}
              className="w-full py-2 text-[#949ba4] hover:text-white text-[14px] font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Step 1
            </button>
          </div>
        </div>
      </div>
    );
  }

  // DEFAULT AUTH SCREEN: LOGIN OR SIGNUP
  return (
    <div className="min-h-screen w-full bg-black flex flex-col items-center justify-center p-4 relative">
      {mode === 'login' ? (
        /* LOGIN CARD */
        <div className="w-full max-w-[480px] bg-[#18191c] rounded-[5px] p-8 shadow-[0_2px_10px_0_rgba(0,0,0,0.6)] border border-[#232428]">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Welcome back!
            </h1>
            <p className="text-[#949ba4] text-[15px] mt-2">
              We're so excited to see you again!
            </p>
          </div>

          {forgotPasswordSent && (
            <div className="mb-5 p-3 rounded-[3px] bg-[#ff6b00]/15 border border-[#ff6b00]/30 text-[#ff8f3d] text-[14px]">
              Password reset instructions have been sent to your email.
            </div>
          )}

          <form onSubmit={handleLoginSubmit} noValidate>
            <div className="mb-5">
              <label className="block text-[12px] font-bold tracking-wider text-[#b5bac1] uppercase mb-2">
                Email or Username{' '}
                {loginErrors.email ? (
                  <span className="text-[#ff5c00] italic font-normal lowercase tracking-normal">
                    - {loginErrors.email}
                  </span>
                ) : (
                  <span className="text-[#ff5c00]">*</span>
                )}
              </label>
              <input
                type="text"
                value={loginEmail}
                onChange={(e) => {
                  setLoginEmail(e.target.value);
                  if (loginErrors.email) {
                    setLoginErrors((prev) => ({ ...prev, email: undefined }));
                  }
                }}
                className={`w-full bg-[#111214] text-[#dbdee1] rounded-[3px] px-3 h-10 text-[16px] outline-none border transition-colors ${
                  loginErrors.email
                    ? 'border-[#ff5c00]'
                    : 'border-transparent focus:border-[#ff6b00]'
                }`}
                autoComplete="username"
              />
            </div>

            <div className="mb-2">
              <label className="block text-[12px] font-bold tracking-wider text-[#b5bac1] uppercase mb-2">
                Password{' '}
                {loginErrors.password ? (
                  <span className="text-[#ff5c00] italic font-normal lowercase tracking-normal">
                    - {loginErrors.password}
                  </span>
                ) : (
                  <span className="text-[#ff5c00]">*</span>
                )}
              </label>
              <div className="relative">
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => {
                    setLoginPassword(e.target.value);
                    if (loginErrors.password) {
                      setLoginErrors((prev) => ({ ...prev, password: undefined }));
                    }
                  }}
                  className={`w-full bg-[#111214] text-[#dbdee1] rounded-[3px] pl-3 pr-10 h-10 text-[16px] outline-none border transition-colors ${
                    loginErrors.password
                      ? 'border-[#ff5c00]'
                      : 'border-transparent focus:border-[#ff6b00]'
                  }`}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#949ba4] hover:text-[#dbdee1] transition-colors cursor-pointer"
                  aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                >
                  {showLoginPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="mb-5">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-[14px] text-[#ff6b00] hover:underline cursor-pointer font-medium p-0"
              >
                Forgot your password?
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full h-11 bg-[#ff6b00] hover:bg-[#e55b00] active:bg-[#cc4e00] disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium text-[16px] rounded-[3px] transition-colors cursor-pointer mb-2 flex items-center justify-center gap-2"
            >
              {isLoggingIn && <Loader2 className="w-5 h-5 animate-spin" />}
              {isLoggingIn ? 'Logging In...' : 'Log In'}
            </button>

            <div className="mt-2 text-[14px] text-[#949ba4]">
              Need an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setLoginErrors({});
                }}
                className="text-[#ff6b00] hover:underline cursor-pointer font-medium"
              >
                Register
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* REGISTER INITIAL DETAILS CARD */
        <div className="w-full max-w-[480px] bg-[#18191c] rounded-[5px] p-8 shadow-[0_2px_10px_0_rgba(0,0,0,0.6)] border border-[#232428]">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Create an account
            </h1>
          </div>

          <form onSubmit={handleRegisterSubmit} noValidate>
            <div className="mb-5">
              <label className="block text-[12px] font-bold tracking-wider text-[#b5bac1] uppercase mb-2">
                Email{' '}
                {regErrors.email ? (
                  <span className="text-[#ff5c00] italic font-normal lowercase tracking-normal">
                    - {regErrors.email}
                  </span>
                ) : (
                  <span className="text-[#ff5c00]">*</span>
                )}
              </label>
              <input
                type="email"
                value={regEmail}
                onChange={(e) => {
                  setRegEmail(e.target.value);
                  if (regErrors.email) {
                    setRegErrors((prev) => ({ ...prev, email: undefined }));
                  }
                }}
                className={`w-full bg-[#111214] text-[#dbdee1] rounded-[3px] px-3 h-10 text-[16px] outline-none border transition-colors ${
                  regErrors.email
                    ? 'border-[#ff5c00]'
                    : 'border-transparent focus:border-[#ff6b00]'
                }`}
                autoComplete="email"
              />
            </div>

            <div className="mb-5">
              <label className="block text-[12px] font-bold tracking-wider text-[#b5bac1] uppercase mb-2">
                Display Name
              </label>
              <input
                type="text"
                value={regDisplayName}
                onChange={(e) => setRegDisplayName(e.target.value)}
                className="w-full bg-[#111214] text-[#dbdee1] rounded-[3px] px-3 h-10 text-[16px] outline-none border border-transparent focus:border-[#ff6b00] transition-colors"
                autoComplete="nickname"
              />
            </div>

            <div className="mb-5">
              <label className="block text-[12px] font-bold tracking-wider text-[#b5bac1] uppercase mb-2">
                Username{' '}
                {regErrors.username ? (
                  <span className="text-[#ff5c00] italic font-normal lowercase tracking-normal">
                    - {regErrors.username}
                  </span>
                ) : (
                  <span className="text-[#ff5c00]">*</span>
                )}
              </label>
              <input
                type="text"
                value={regUsername}
                onChange={(e) => {
                  setRegUsername(e.target.value);
                  if (regErrors.username) {
                    setRegErrors((prev) => ({ ...prev, username: undefined }));
                  }
                }}
                className={`w-full bg-[#111214] text-[#dbdee1] rounded-[3px] px-3 h-10 text-[16px] outline-none border transition-colors ${
                  regErrors.username
                    ? 'border-[#ff5c00]'
                    : 'border-transparent focus:border-[#ff6b00]'
                }`}
                autoComplete="username"
              />
            </div>

            <div className="mb-5">
              <label className="block text-[12px] font-bold tracking-wider text-[#b5bac1] uppercase mb-2">
                Password{' '}
                {regErrors.password ? (
                  <span className="text-[#ff5c00] italic font-normal lowercase tracking-normal">
                    - {regErrors.password}
                  </span>
                ) : (
                  <span className="text-[#ff5c00]">*</span>
                )}
              </label>
              <div className="relative">
                <input
                  type={showRegPassword ? 'text' : 'password'}
                  value={regPassword}
                  onChange={(e) => {
                    setRegPassword(e.target.value);
                    if (regErrors.password) {
                      setRegErrors((prev) => ({ ...prev, password: undefined }));
                    }
                  }}
                  className={`w-full bg-[#111214] text-[#dbdee1] rounded-[3px] pl-3 pr-10 h-10 text-[16px] outline-none border transition-colors ${
                    regErrors.password
                      ? 'border-[#ff5c00]'
                      : 'border-transparent focus:border-[#ff6b00]'
                  }`}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#949ba4] hover:text-[#dbdee1] transition-colors cursor-pointer"
                  aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                >
                  {showRegPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-[12px] font-bold tracking-wider text-[#b5bac1] uppercase mb-2">
                Date of Birth{' '}
                {regErrors.dob ? (
                  <span className="text-[#ff5c00] italic font-normal lowercase tracking-normal">
                    - {regErrors.dob}
                  </span>
                ) : (
                  <span className="text-[#ff5c00]">*</span>
                )}
              </label>
              <div className="grid grid-cols-3 gap-3">
                <div className="relative">
                  <select
                    value={birthMonth}
                    onChange={(e) => {
                      setBirthMonth(e.target.value);
                      if (regErrors.dob) {
                        setRegErrors((prev) => ({ ...prev, dob: undefined }));
                      }
                    }}
                    className={`w-full appearance-none bg-[#111214] text-[#dbdee1] rounded-[3px] pl-3 pr-8 h-10 text-[15px] outline-none border transition-colors cursor-pointer ${
                      regErrors.dob
                        ? 'border-[#ff5c00]'
                        : 'border-transparent focus:border-[#ff6b00]'
                    } ${!birthMonth ? 'text-[#949ba4]' : ''}`}
                  >
                    <option value="" disabled className="bg-[#111214] text-[#949ba4]">
                      Month
                    </option>
                    {months.map((m) => (
                      <option key={m} value={m} className="bg-[#111214] text-[#dbdee1]">
                        {m}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-[#949ba4] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                <div className="relative">
                  <select
                    value={birthDay}
                    onChange={(e) => {
                      setBirthDay(e.target.value);
                      if (regErrors.dob) {
                        setRegErrors((prev) => ({ ...prev, dob: undefined }));
                      }
                    }}
                    className={`w-full appearance-none bg-[#111214] text-[#dbdee1] rounded-[3px] pl-3 pr-8 h-10 text-[15px] outline-none border transition-colors cursor-pointer ${
                      regErrors.dob
                        ? 'border-[#ff5c00]'
                        : 'border-transparent focus:border-[#ff6b00]'
                    } ${!birthDay ? 'text-[#949ba4]' : ''}`}
                  >
                    <option value="" disabled className="bg-[#111214] text-[#949ba4]">
                      Day
                    </option>
                    {days.map((d) => (
                      <option key={d} value={d} className="bg-[#111214] text-[#dbdee1]">
                        {d}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-[#949ba4] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                <div className="relative">
                  <select
                    value={birthYear}
                    onChange={(e) => {
                      setBirthYear(e.target.value);
                      if (regErrors.dob) {
                        setRegErrors((prev) => ({ ...prev, dob: undefined }));
                      }
                    }}
                    className={`w-full appearance-none bg-[#111214] text-[#dbdee1] rounded-[3px] pl-3 pr-8 h-10 text-[15px] outline-none border transition-colors cursor-pointer ${
                      regErrors.dob
                        ? 'border-[#ff5c00]'
                        : 'border-transparent focus:border-[#ff6b00]'
                    } ${!birthYear ? 'text-[#949ba4]' : ''}`}
                  >
                    <option value="" disabled className="bg-[#111214] text-[#949ba4]">
                      Year
                    </option>
                    {years.map((y) => (
                      <option key={y} value={y} className="bg-[#111214] text-[#dbdee1]">
                        {y}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-[#949ba4] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="mb-6 flex items-start gap-2.5">
              <label className="relative flex items-center cursor-pointer mt-0.5">
                <input
                  type="checkbox"
                  checked={subscribeNewsletter}
                  onChange={(e) => setSubscribeNewsletter(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-5 h-5 rounded-[4px] border border-[#4e5058] bg-[#111214] peer-checked:bg-[#ff6b00] peer-checked:border-[#ff6b00] flex items-center justify-center transition-colors">
                  {subscribeNewsletter && (
                    <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                  )}
                </div>
              </label>
              <span
                onClick={() => setSubscribeNewsletter(!subscribeNewsletter)}
                className="text-[12px] text-[#949ba4] cursor-pointer select-none leading-tight"
              >
                (Optional) It's okay to send me emails with Yapzo updates, tips, and special offers. You can opt out at any time.
              </span>
            </div>

            <button
              type="submit"
              disabled={isCheckingAccount}
              className="w-full h-11 bg-[#ff6b00] hover:bg-[#e55b00] active:bg-[#cc4e00] disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium text-[16px] rounded-[3px] transition-colors cursor-pointer mb-3 flex items-center justify-center gap-2"
            >
              {isCheckingAccount && <Loader2 className="w-5 h-5 animate-spin" />}
              {isCheckingAccount ? 'Checking availability...' : 'Continue'}
            </button>

            <p className="text-[12px] text-[#949ba4] leading-relaxed mb-4">
              By clicking Continue, you proceed to customize your profile and review the Terms of Service.
            </p>

            <button
              type="button"
              onClick={() => {
                setMode('login');
                setRegErrors({});
              }}
              className="text-[14px] text-[#ff6b00] hover:underline cursor-pointer font-medium"
            >
              Already have an account?
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

import {
  ref,
  set,
  get,
  child,
  push,
  update,
  remove,
  onValue,
  query,
  limitToLast
} from 'firebase/database';
import { rtdb } from './firebase';

// ── Server types ──────────────────────────────────────────────────────────

export interface ServerData {
  id: string;
  name: string;
  description?: string;
  icon: string | null;
  banner?: string | null;
  ownerId: string;
  ownerUsername: string;
  ownerDisplayName: string;
  createdAt: number;
  isPublic: boolean;
  memberCount: number;
  channels: ServerChannelData[];
}

export interface ServerChannelData {
  id: string;
  name: string;
  description: string;
  category: string;
}

export interface ServerMember {
  userId: string;
  username: string;
  displayName: string;
  avatar: string | null;
  joinedAt: number;
}

export interface ServerInvite {
  code: string;
  serverId: string;
  serverName: string;
  serverIcon: string | null;
  createdBy: string;
  createdAt: number;
  expiresAt: number | null; // null = never
  maxUses: number | null; // null = unlimited
  uses: number;
}

const DEFAULT_CHANNELS: ServerChannelData[] = [
  { id: 'welcome', name: 'welcome', description: 'Welcome to the server! Say hello here.', category: 'Information' },
  { id: 'general', name: 'general', description: 'General discussion for everyone.', category: 'Text Channels' },
  { id: 'off-topic', name: 'off-topic', description: 'Casual conversation and random thoughts.', category: 'Text Channels' }
];

function generateInviteCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function createServer(
  owner: { userId: string; username: string; displayName: string; avatar: string | null },
  data: { name: string; description?: string; icon?: string | null; banner?: string | null; isPublic?: boolean }
): Promise<string> {
  const serverId = `srv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const server: ServerData = {
    id: serverId,
    name: data.name,
    description: data.description || '',
    icon: data.icon || null,
    banner: data.banner || null,
    ownerId: owner.userId,
    ownerUsername: owner.username,
    ownerDisplayName: owner.displayName,
    createdAt: Date.now(),
    isPublic: data.isPublic ?? false,
    memberCount: 1,
    channels: DEFAULT_CHANNELS
  };

  const member: ServerMember = {
    userId: owner.userId,
    username: owner.username,
    displayName: owner.displayName,
    avatar: owner.avatar || null,
    joinedAt: Date.now()
  };

  const updates: Record<string, any> = {};
  updates[`servers/${serverId}`] = cleanUndefined(server);
  updates[`server_members/${serverId}/${normalizeKey(owner.userId)}`] = cleanUndefined(member);
  updates[`user_servers/${normalizeKey(owner.userId)}/${serverId}`] = true;

  await update(ref(rtdb), updates);
  return serverId;
}

export function subscribeToUserServers(
  userId: string,
  callback: (servers: ServerData[]) => void
): () => void {
  const userServersRef = ref(rtdb, `user_servers/${normalizeKey(userId)}`);

  const unsubscribe = onValue(userServersRef, async (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    const serverIds = Object.keys(snapshot.val());
    const servers: ServerData[] = [];
    for (const sid of serverIds) {
      const srvSnap = await get(child(ref(rtdb), `servers/${sid}`));
      if (srvSnap.exists()) {
        servers.push({ ...srvSnap.val(), id: sid });
      }
    }
    servers.sort((a, b) => a.createdAt - b.createdAt);
    callback(servers);
  });

  return unsubscribe;
}

export function subscribeToPublicServers(
  callback: (servers: ServerData[]) => void
): () => void {
  const serversRef = ref(rtdb, 'servers');

  const unsubscribe = onValue(serversRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    const val = snapshot.val();
    const servers: ServerData[] = [];
    for (const sid of Object.keys(val)) {
      const s = val[sid];
      if (s && s.isPublic) {
        servers.push({ ...s, id: sid });
      }
    }
    servers.sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0));
    callback(servers);
  });

  return unsubscribe;
}

export async function joinServer(serverId: string, user: { userId: string; username: string; displayName: string; avatar: string | null }): Promise<{ success: boolean; error?: string }> {
  const serverSnap = await get(child(ref(rtdb), `servers/${serverId}`));
  if (!serverSnap.exists()) {
    return { success: false, error: 'Server not found' };
  }

  const member: ServerMember = {
    userId: user.userId,
    username: user.username,
    displayName: user.displayName,
    avatar: user.avatar || null,
    joinedAt: Date.now()
  };

  const updates: Record<string, any> = {};
  updates[`server_members/${serverId}/${normalizeKey(user.userId)}`] = cleanUndefined(member);
  updates[`user_servers/${normalizeKey(user.userId)}/${serverId}`] = true;

  // Increment member count
  const server = serverSnap.val() as ServerData;
  updates[`servers/${serverId}/memberCount`] = (server.memberCount || 0) + 1;

  await update(ref(rtdb), updates);
  return { success: true };
}

export async function leaveServer(serverId: string, userId: string): Promise<void> {
  const updates: Record<string, any> = {};
  updates[`server_members/${serverId}/${normalizeKey(userId)}`] = null;
  updates[`user_servers/${normalizeKey(userId)}/${serverId}`] = null;

  // Decrement member count
  const serverSnap = await get(child(ref(rtdb), `servers/${serverId}`));
  if (serverSnap.exists()) {
    const server = serverSnap.val() as ServerData;
    updates[`servers/${serverId}/memberCount`] = Math.max(0, (server.memberCount || 1) - 1);
  }

  await update(ref(rtdb), updates);
}

export async function deleteServer(serverId: string): Promise<void> {
  const serverSnap = await get(child(ref(rtdb), `servers/${serverId}`));
  if (!serverSnap.exists()) return;

  const updates: Record<string, any> = {};
  updates[`servers/${serverId}`] = null;
  updates[`server_members/${serverId}`] = null;
  updates[`server_invites/${serverId}`] = null;

  // Remove from all users' server lists
  const membersSnap = await get(child(ref(rtdb), `server_members/${serverId}`));
  if (membersSnap.exists()) {
    const members = membersSnap.val();
    for (const mKey of Object.keys(members)) {
      const member = members[mKey] as ServerMember;
      updates[`user_servers/${normalizeKey(member.userId)}/${serverId}`] = null;
    }
  }

  await update(ref(rtdb), updates);
}

export async function updateServer(serverId: string, partial: Partial<ServerData>): Promise<void> {
  const serverRef = ref(rtdb, `servers/${serverId}`);
  await update(serverRef, cleanUndefined(partial));
}

export function subscribeToServerMembers(
  serverId: string,
  callback: (members: ServerMember[]) => void
): () => void {
  const membersRef = ref(rtdb, `server_members/${serverId}`);

  const unsubscribe = onValue(membersRef, (snapshot) => {
    const members: ServerMember[] = [];
    if (snapshot.exists()) {
      const val = snapshot.val();
      for (const k of Object.keys(val)) {
        members.push({ ...val[k] });
      }
    }
    members.sort((a, b) => a.joinedAt - b.joinedAt);
    callback(members);
  });

  return unsubscribe;
}

export async function createInvite(serverId: string, createdBy: string, options?: { expiresInHours?: number | null; maxUses?: number | null }): Promise<ServerInvite> {
  const serverSnap = await get(child(ref(rtdb), `servers/${serverId}`));
  if (!serverSnap.exists()) throw new Error('Server not found');
  const server = serverSnap.val() as ServerData;

  const code = generateInviteCode();
  const now = Date.now();
  const invite: ServerInvite = {
    code,
    serverId,
    serverName: server.name,
    serverIcon: server.icon || null,
    createdBy,
    createdAt: now,
    expiresAt: options?.expiresInHours ? now + options.expiresInHours * 3600000 : null,
    maxUses: options?.maxUses ?? null,
    uses: 0
  };

  await set(ref(rtdb, `server_invites/${serverId}/${code}`), cleanUndefined(invite));
  await set(ref(rtdb, `invite_codes/${code}`), { serverId });
  return invite;
}

export function subscribeToServerInvites(
  serverId: string,
  callback: (invites: ServerInvite[]) => void
): () => void {
  const invitesRef = ref(rtdb, `server_invites/${serverId}`);

  const unsubscribe = onValue(invitesRef, (snapshot) => {
    const invites: ServerInvite[] = [];
    if (snapshot.exists()) {
      const val = snapshot.val();
      for (const k of Object.keys(val)) {
        invites.push({ ...val[k], code: k });
      }
    }
    invites.sort((a, b) => b.createdAt - a.createdAt);
    callback(invites);
  });

  return unsubscribe;
}

export async function revokeInvite(serverId: string, code: string): Promise<void> {
  const updates: Record<string, any> = {};
  updates[`server_invites/${serverId}/${code}`] = null;
  updates[`invite_codes/${code}`] = null;
  await update(ref(rtdb), updates);
}

export async function joinServerByInvite(
  code: string,
  user: { userId: string; username: string; displayName: string; avatar: string | null }
): Promise<{ success: boolean; error?: string; serverId?: string }> {
  const codeSnap = await get(child(ref(rtdb), `invite_codes/${code}`));
  if (!codeSnap.exists()) {
    return { success: false, error: 'Invalid or expired invite code' };
  }

  const serverId = codeSnap.val() as string;
  const inviteSnap = await get(child(ref(rtdb), `server_invites/${serverId}/${code}`));
  if (!inviteSnap.exists()) {
    return { success: false, error: 'This invite has been revoked' };
  }

  const invite = inviteSnap.val() as ServerInvite;

  if (invite.expiresAt && Date.now() > invite.expiresAt) {
    return { success: false, error: 'This invite has expired' };
  }

  if (invite.maxUses !== null && invite.uses >= invite.maxUses) {
    return { success: false, error: 'This invite has reached its maximum uses' };
  }

  // Check if already a member
  const memberSnap = await get(child(ref(rtdb), `server_members/${serverId}/${normalizeKey(user.userId)}`));
  if (memberSnap.exists()) {
    return { success: false, error: 'You are already a member of this server' };
  }

  const result = await joinServer(serverId, user);
  if (!result.success) return result;

  // Increment invite uses
  await update(ref(rtdb, `server_invites/${serverId}/${code}`), { uses: invite.uses + 1 });

  return { success: true, serverId };
}

export function subscribeToServerChannels(
  serverId: string,
  callback: (channels: ServerChannelData[]) => void
): () => void {
  const channelsRef = ref(rtdb, `servers/${serverId}/channels`);

  const unsubscribe = onValue(channelsRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback(DEFAULT_CHANNELS);
      return;
    }
    const val = snapshot.val();
    if (Array.isArray(val)) {
      callback(val);
    } else {
      const channels: ServerChannelData[] = [];
      for (const k of Object.keys(val)) {
        channels.push(val[k]);
      }
      callback(channels);
    }
  });

  return unsubscribe;
}

export async function addServerChannel(serverId: string, channel: ServerChannelData): Promise<void> {
  const channelsSnap = await get(child(ref(rtdb), `servers/${serverId}/channels`));
  let channels: ServerChannelData[] = [];
  if (channelsSnap.exists()) {
    const val = channelsSnap.val();
    if (Array.isArray(val)) {
      channels = val;
    } else {
      channels = Object.values(val);
    }
  }
  channels.push(channel);
  await update(ref(rtdb, `servers/${serverId}`), { channels: cleanUndefined(channels) });
}

export async function getServerById(serverId: string): Promise<ServerData | null> {
  const snap = await get(child(ref(rtdb), `servers/${serverId}`));
  if (!snap.exists()) return null;
  return { ...snap.val(), id: serverId } as ServerData;
}

export type UserStatus = 'online' | 'idle' | 'dnd' | 'offline';

export interface UserProfile {
  id: string; // clean username key
  username: string; // unique lowercase handle
  email: string; // unique lowercase email
  displayName: string;
  password?: string;
  avatar: string | null; // Cloudinary URL
  banner: string | null; // Cloudinary URL
  pronouns: string;
  aboutMe: string;
  status: UserStatus;
  isMuted: boolean;
  isDeafened: boolean;
  createdAt: number;
  lastSeen: number;
  birthDate?: {
    month: string;
    day: string;
    year: string;
  };
  newsletter?: boolean;
  pinnedDms?: Record<string, boolean>;
  clearedDms?: Record<string, number>;
  closedDms?: Record<string, boolean>;
}

export interface MessageReplyInfo {
  id: string;
  text?: string;
  imageUrl?: string | null;
  authorDisplayName: string;
  authorUsername: string;
  authorAvatar?: string | null;
}

export interface ChatMessage {
  id: string;
  channelId?: string;
  text: string;
  imageUrl?: string | null;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatar: string | null;
  timestamp: string;
  createdAt: number;
  replyTo?: MessageReplyInfo | null;
  reactions?: Record<string, string[]>;
}

export interface FriendItem {
  id: string; // clean username key
  username: string;
  displayName: string;
  avatar: string | null;
  status?: UserStatus;
  aboutMe?: string;
  addedAt: number;
  requestStatus?: 'accepted' | 'pending_incoming' | 'pending_outgoing';
}

/**
 * Recursively removes undefined values from an object/array so Firebase Realtime Database
 * operations never throw "value argument contains undefined".
 */
export function cleanUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => cleanUndefined(item)) as unknown as T;
  }
  const cleaned: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const val = (obj as any)[key];
    if (val !== undefined) {
      cleaned[key] = cleanUndefined(val);
    }
  }
  return cleaned as T;
}

/**
 * Normalizes username for safe Firebase Realtime Database path key.
 * Disallows: . # $ [ ] /
 */
export function normalizeKey(str: string): string {
  return str.trim().toLowerCase().replace(/[.#$[\]/]/g, '_');
}

/**
 * Encodes email for RTDB key indexing (replaces dots with commas).
 */
export function encodeEmailKey(email: string): string {
  return email.trim().toLowerCase().replace(/\./g, ',');
}

/**
 * Checks if a handle/username or email is already taken in the Realtime Database.
 */
export async function checkHandleOrEmailExists(
  username: string,
  email: string
): Promise<{ usernameTaken: boolean; emailTaken: boolean }> {
  const userKey = normalizeKey(username);
  const emailKey = encodeEmailKey(email);

  const dbRef = ref(rtdb);

  const [userSnap, emailSnap] = await Promise.all([
    get(child(dbRef, `users/${userKey}`)),
    get(child(dbRef, `emails/${emailKey}`))
  ]);

  return {
    usernameTaken: userSnap.exists(),
    emailTaken: emailSnap.exists()
  };
}

/**
 * Finds user profile in Realtime Database by either Handle or Email.
 */
export async function findUserByHandleOrEmail(handleOrEmail: string): Promise<UserProfile | null> {
  const cleanInput = handleOrEmail.trim().toLowerCase();
  const dbRef = ref(rtdb);

  if (cleanInput.includes('@')) {
    // Lookup by email index
    const emailKey = encodeEmailKey(cleanInput);
    const emailSnap = await get(child(dbRef, `emails/${emailKey}`));
    if (emailSnap.exists()) {
      const usernameKey = emailSnap.val();
      const userSnap = await get(child(dbRef, `users/${usernameKey}`));
      if (userSnap.exists()) {
        return { ...(userSnap.val() as UserProfile), id: usernameKey };
      }
    }
  }

  // Lookup by username key
  const userKey = normalizeKey(cleanInput);
  const userSnap = await get(child(dbRef, `users/${userKey}`));
  if (userSnap.exists()) {
    return { ...(userSnap.val() as UserProfile), id: userKey };
  }

  // Fallback: search all users if not found by primary key
  const allUsersSnap = await get(child(dbRef, 'users'));
  if (allUsersSnap.exists()) {
    const data = allUsersSnap.val();
    for (const k of Object.keys(data)) {
      const u = data[k] as UserProfile;
      if (u.email?.toLowerCase() === cleanInput || u.username?.toLowerCase() === cleanInput) {
        return { ...u, id: k };
      }
    }
  }

  return null;
}

/**
 * Saves a new user profile and indexes the email in the Realtime Database.
 */
export async function saveUserProfile(profile: UserProfile): Promise<void> {
  const userKey = normalizeKey(profile.username);
  const emailKey = encodeEmailKey(profile.email);

  const updates: Record<string, any> = {};
  updates[`users/${userKey}`] = { ...profile, id: userKey };
  updates[`emails/${emailKey}`] = userKey;

  await update(ref(rtdb), cleanUndefined(updates));
}

/**
 * Partially updates an existing user profile in the Realtime Database.
 */
export async function updateUserProfile(userId: string, partial: Partial<UserProfile>): Promise<void> {
  try {
    const userKey = normalizeKey(userId);
    const userRef = ref(rtdb, `users/${userKey}`);
    await update(
      userRef,
      cleanUndefined({
        ...partial,
        lastSeen: Date.now()
      })
    );
  } catch (err) {
    console.error('Error updating user in Realtime Database:', err);
  }
}

/**
 * Real-time listener for all users in Realtime Database.
 */
export function subscribeToAllUsers(callback: (users: UserProfile[]) => void): () => void {
  const usersRef = ref(rtdb, 'users');
  const unsubscribe = onValue(
    usersRef,
    (snapshot) => {
      const list: UserProfile[] = [];
      if (snapshot.exists()) {
        const val = snapshot.val();
        Object.keys(val).forEach((k) => {
          list.push({ ...val[k], id: k });
        });
      }
      callback(list);
    },
    (error) => {
      console.warn('Realtime Database users listener warning:', error);
    }
  );
  return unsubscribe;
}

/**
 * Real-time listener for channel messages in Realtime Database.
 */
export function subscribeToChannelMessages(
  channelId: string,
  callback: (messages: ChatMessage[]) => void
): () => void {
  const channelKey = normalizeKey(channelId);
  const messagesQuery = query(ref(rtdb, `channels/${channelKey}/messages`), limitToLast(150));

  const unsubscribe = onValue(
    messagesQuery,
    (snapshot) => {
      const msgs: ChatMessage[] = [];
      if (snapshot.exists()) {
        const val = snapshot.val();
        Object.keys(val).forEach((id) => {
          msgs.push({
            id,
            ...val[id]
          });
        });
        msgs.sort((a, b) => a.createdAt - b.createdAt);
      }
      callback(msgs);
    },
    (error) => {
      console.warn(`Realtime Database channel (${channelId}) listener warning:`, error);
    }
  );

  return unsubscribe;
}

/**
 * Posts a message to a channel in the Realtime Database.
 */
export async function sendChannelMessage(
  channelId: string,
  message: Omit<ChatMessage, 'id'>
): Promise<string> {
  const channelKey = normalizeKey(channelId);
  const messagesRef = ref(rtdb, `channels/${channelKey}/messages`);
  const newMsgRef = push(messagesRef);
  await set(newMsgRef, cleanUndefined(message));
  return newMsgRef.key || `${Date.now()}`;
}

/**
 * Real-time listener for self-messages (notes to yourself in DM).
 */
export function subscribeToSelfMessages(
  userId: string,
  callback: (messages: ChatMessage[]) => void
): () => void {
  const userKey = normalizeKey(userId);
  const selfNotesRef = ref(rtdb, `self_notes/${userKey}`);

  const unsubscribe = onValue(
    selfNotesRef,
    (snapshot) => {
      const msgs: ChatMessage[] = [];
      if (snapshot.exists()) {
        const val = snapshot.val();
        Object.keys(val).forEach((id) => {
          msgs.push({
            id,
            ...val[id]
          });
        });
        msgs.sort((a, b) => a.createdAt - b.createdAt);
      }
      callback(msgs);
    },
    (error) => {
      console.warn('Realtime Database self notes listener warning:', error);
    }
  );

  return unsubscribe;
}

/**
 * Posts a self-note in the Realtime Database.
 */
export async function sendSelfMessage(
  userId: string,
  message: Omit<ChatMessage, 'id'>
): Promise<string> {
  const userKey = normalizeKey(userId);
  const selfNotesRef = ref(rtdb, `self_notes/${userKey}`);
  const newNoteRef = push(selfNotesRef);
  await set(newNoteRef, cleanUndefined(message));
  return newNoteRef.key || `${Date.now()}`;
}

/**
 * Deletes a self-note from the Realtime Database.
 */
export async function deleteSelfMessage(userId: string, messageId: string): Promise<void> {
  const userKey = normalizeKey(userId);
  const noteRef = ref(rtdb, `self_notes/${userKey}/${messageId}`);
  await remove(noteRef);
}

/**
 * Deletes a channel message from the Realtime Database.
 */
export async function deleteChannelMessage(channelId: string, messageId: string): Promise<void> {
  const channelKey = normalizeKey(channelId);
  const msgRef = ref(rtdb, `channels/${channelKey}/messages/${messageId}`);
  await remove(msgRef);
}

/**
 * Generates a deterministic DM chat ID between two users (alphabetical order).
 */
export function getDmChatId(userA: string, userB: string): string {
  const keyA = normalizeKey(userA);
  const keyB = normalizeKey(userB);
  return [keyA, keyB].sort().join('__');
}

/**
 * Real-time listener for direct messages between two users in Realtime Database.
 */
export function subscribeToDmMessages(
  userA: string,
  userB: string,
  callback: (messages: ChatMessage[]) => void
): () => void {
  const dmChatId = getDmChatId(userA, userB);
  const messagesQuery = query(ref(rtdb, `direct_messages/${dmChatId}/messages`), limitToLast(150));

  const unsubscribe = onValue(
    messagesQuery,
    (snapshot) => {
      const msgs: ChatMessage[] = [];
      if (snapshot.exists()) {
        const val = snapshot.val();
        Object.keys(val).forEach((id) => {
          msgs.push({
            id,
            ...val[id]
          });
        });
        msgs.sort((a, b) => a.createdAt - b.createdAt);
      }
      callback(msgs);
    },
    (error) => {
      console.warn(`Realtime Database DM (${dmChatId}) listener warning:`, error);
    }
  );

  return unsubscribe;
}

/**
 * Sends a direct message between two users in Realtime Database.
 */
export async function sendDmMessage(
  userA: string,
  userB: string,
  message: Omit<ChatMessage, 'id'>
): Promise<string> {
  const dmChatId = getDmChatId(userA, userB);
  const messagesRef = ref(rtdb, `direct_messages/${dmChatId}/messages`);
  const newMsgRef = push(messagesRef);
  await set(newMsgRef, cleanUndefined(message));
  return newMsgRef.key || `${Date.now()}`;
}

/**
 * Deletes a direct message from Realtime Database.
 */
export async function deleteDmMessage(dmChatId: string, messageId: string): Promise<void> {
  const msgRef = ref(rtdb, `direct_messages/${dmChatId}/messages/${messageId}`);
  await remove(msgRef);
}

/**
 * Generic message deleter for channel, DM, or self notes.
 */
export async function deleteMessage(
  type: 'channel' | 'self' | 'dm',
  contextKey: string,
  messageId: string
): Promise<void> {
  let path = '';
  if (type === 'channel') {
    path = `channels/${normalizeKey(contextKey)}/messages/${messageId}`;
  } else if (type === 'self') {
    path = `self_notes/${normalizeKey(contextKey)}/${messageId}`;
  } else {
    path = `direct_messages/${contextKey}/messages/${messageId}`;
  }
  const targetRef = ref(rtdb, path);
  await remove(targetRef);
}

/**
 * Toggles a user's reaction on a message in Realtime Database.
 */
export async function toggleMessageReaction(
  type: 'channel' | 'self' | 'dm',
  contextKey: string,
  messageId: string,
  emoji: string,
  username: string
): Promise<void> {
  let path = '';
  if (type === 'channel') {
    path = `channels/${normalizeKey(contextKey)}/messages/${messageId}/reactions`;
  } else if (type === 'self') {
    path = `self_notes/${normalizeKey(contextKey)}/${messageId}/reactions`;
  } else {
    path = `direct_messages/${contextKey}/messages/${messageId}/reactions`;
  }

  const reactionsRef = ref(rtdb, path);
  const snap = await get(reactionsRef);
  const reactions: Record<string, string[]> = snap.exists() ? snap.val() : {};

  const cleanUser = normalizeKey(username);
  const currentUsers: string[] = Array.isArray(reactions[emoji]) ? reactions[emoji] : [];

  if (currentUsers.includes(cleanUser)) {
    // User already reacted -> remove
    const filtered = currentUsers.filter((u) => u !== cleanUser);
    if (filtered.length > 0) {
      reactions[emoji] = filtered;
    } else {
      delete reactions[emoji];
    }
  } else {
    // Add reaction
    reactions[emoji] = [...currentUsers, cleanUser];
  }

  await set(reactionsRef, cleanUndefined(reactions));
}

/**
 * Adds a friend request by target handle or email.
 */
export async function addFriend(
  myProfile: UserProfile,
  targetHandleOrEmail: string
): Promise<{ success: boolean; error?: string; friend?: FriendItem }> {
  const cleanTarget = targetHandleOrEmail.trim().toLowerCase();
  const myClean = normalizeKey(myProfile.username);

  if (cleanTarget === myClean || cleanTarget === myProfile.email?.toLowerCase()) {
    return { success: false, error: 'You cannot add yourself as a friend!' };
  }

  const targetUser = await findUserByHandleOrEmail(cleanTarget);
  if (!targetUser) {
    return { success: false, error: `No Yapzo user found with handle or email "${targetHandleOrEmail}".` };
  }

  const targetClean = normalizeKey(targetUser.username);
  if (targetClean === myClean) {
    return { success: false, error: 'You cannot add yourself as a friend!' };
  }

  const myFriendEntry: FriendItem = {
    id: targetClean,
    username: targetUser.username,
    displayName: targetUser.displayName || targetUser.username,
    avatar: targetUser.avatar || null,
    status: targetUser.status || 'offline',
    aboutMe: targetUser.aboutMe || '',
    addedAt: Date.now(),
    requestStatus: 'pending_outgoing'
  };

  const theirFriendEntry: FriendItem = {
    id: myClean,
    username: myProfile.username,
    displayName: myProfile.displayName || myProfile.username,
    avatar: myProfile.avatar || null,
    status: myProfile.status || 'online',
    aboutMe: myProfile.aboutMe || '',
    addedAt: Date.now(),
    requestStatus: 'pending_incoming'
  };

  const updates: Record<string, any> = {};
  updates[`friends/${myClean}/${targetClean}`] = myFriendEntry;
  updates[`friends/${targetClean}/${myClean}`] = theirFriendEntry;

  await update(ref(rtdb), cleanUndefined(updates));

  return { success: true, friend: myFriendEntry };
}

/**
 * Accepts a pending friend request.
 */
export async function acceptFriendRequest(myUsername: string, targetUsername: string): Promise<void> {
  const myClean = normalizeKey(myUsername);
  const targetClean = normalizeKey(targetUsername);

  const updates: Record<string, any> = {};
  updates[`friends/${myClean}/${targetClean}/requestStatus`] = 'accepted';
  updates[`friends/${targetClean}/${myClean}/requestStatus`] = 'accepted';

  await update(ref(rtdb), updates);
}

/**
 * Declines or cancels a friend request.
 */
export async function declineFriendRequest(myUsername: string, targetUsername: string): Promise<void> {
  await removeFriend(myUsername, targetUsername);
}

/**
 * Removes a friend.
 */
export async function removeFriend(myUsername: string, targetUsername: string): Promise<void> {
  const myClean = normalizeKey(myUsername);
  const targetClean = normalizeKey(targetUsername);

  const updates: Record<string, any> = {};
  updates[`friends/${myClean}/${targetClean}`] = null;
  updates[`friends/${targetClean}/${myClean}`] = null;

  await update(ref(rtdb), updates);
}

/**
 * Real-time listener for user's friends in Realtime Database.
 */
export function subscribeToFriends(
  myUsername: string,
  callback: (friends: FriendItem[]) => void
): () => void {
  const myClean = normalizeKey(myUsername);
  const friendsRef = ref(rtdb, `friends/${myClean}`);

  const unsubscribe = onValue(
    friendsRef,
    (snapshot) => {
      const list: FriendItem[] = [];
      if (snapshot.exists()) {
        const val = snapshot.val();
        Object.keys(val).forEach((k) => {
          if (val[k]) {
            list.push({
              ...val[k],
              id: k,
              requestStatus: val[k].requestStatus || 'accepted'
            });
          }
        });
        list.sort((a, b) => b.addedAt - a.addedAt);
      }
      callback(list);
    },
    (error) => {
      console.warn('Realtime Database friends listener warning:', error);
    }
  );

  return unsubscribe;
}

/**
 * Toggles a pinned DM for a user in Realtime Database.
 */
export async function togglePinDm(
  userId: string,
  targetDmKey: string,
  isPinned: boolean
): Promise<void> {
  const userKey = normalizeKey(userId);
  const dmKey = normalizeKey(targetDmKey);
  const pinRef = ref(rtdb, `users/${userKey}/pinnedDms/${dmKey}`);
  if (isPinned) {
    await set(pinRef, true);
  } else {
    await remove(pinRef);
  }
}

/**
 * Clears DM chat history for a single user locally in Realtime Database.
 */
export async function clearUserDmChat(
  userId: string,
  targetDmKey: string
): Promise<void> {
  const userKey = normalizeKey(userId);
  const dmKey = normalizeKey(targetDmKey);
  const clearRef = ref(rtdb, `users/${userKey}/clearedDms/${dmKey}`);
  await set(clearRef, Date.now());
}

/**
 * Marks a DM conversation as closed/removed or open for a user in Realtime Database.
 */
export async function setClosedDm(
  userId: string,
  targetDmKey: string,
  isClosed: boolean
): Promise<void> {
  const userKey = normalizeKey(userId);
  const dmKey = normalizeKey(targetDmKey);
  const closedRef = ref(rtdb, `users/${userKey}/closedDms/${dmKey}`);
  if (isClosed) {
    await set(closedRef, true);
  } else {
    await remove(closedRef);
  }
}

export interface TypingUser {
  username: string;
  displayName: string;
  avatar: string | null;
  timestamp: number;
}

/**
 * Sets or clears typing indicator status for a given chat context (channel or DM).
 */
export async function setTypingStatus(
  contextId: string,
  user: { username: string; displayName: string; avatar: string | null },
  isTyping: boolean
): Promise<void> {
  if (!contextId || !user.username) return;
  const safeContext = normalizeKey(contextId);
  const safeUser = normalizeKey(user.username);
  const typingUserRef = ref(rtdb, `typing/${safeContext}/${safeUser}`);

  if (isTyping) {
    await set(typingUserRef, {
      username: user.username,
      displayName: user.displayName || user.username,
      avatar: user.avatar || null,
      timestamp: Date.now()
    });
  } else {
    await remove(typingUserRef);
  }
}

/**
 * Subscribes to real-time typing indicators for a channel or DM.
 * Automatically cleans up expired statuses (> 6 seconds old).
 */
export function subscribeToTyping(
  contextId: string,
  callback: (users: TypingUser[]) => void
): () => void {
  if (!contextId) return () => {};
  const safeContext = normalizeKey(contextId);
  const typingRef = ref(rtdb, `typing/${safeContext}`);

  const unsubscribe = onValue(typingRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    const val = snapshot.val();
    const now = Date.now();
    const users: TypingUser[] = [];
    for (const key of Object.keys(val)) {
      const u = val[key];
      if (u && u.username && now - (u.timestamp || 0) < 6000) {
        users.push({
          username: u.username,
          displayName: u.displayName || u.username,
          avatar: u.avatar || null,
          timestamp: u.timestamp || now
        });
      }
    }
    callback(users);
  });

  return unsubscribe;
}

/**
 * Detects whether a message pings (mentions or replies to) the given user.
 */
export function isMessagePingForUser(
  msg: {
    authorUsername?: string;
    text?: string;
    replyTo?: { authorUsername?: string } | null;
  },
  currentUsername: string,
  currentDisplayName?: string
): boolean {
  if (!msg || !currentUsername) return false;
  const isAuthor = msg.authorUsername?.toLowerCase() === currentUsername.toLowerCase();
  if (isAuthor) return false;

  // Check if message is a reply to the current user
  if (
    msg.replyTo &&
    msg.replyTo.authorUsername &&
    msg.replyTo.authorUsername.toLowerCase() === currentUsername.toLowerCase()
  ) {
    return true;
  }

  const text = msg.text || '';
  if (!text) return false;

  // Check @everyone or @here
  if (/@everyone(?=[^a-zA-Z0-9_.-]|$)/i.test(text) || /@here(?=[^a-zA-Z0-9_.-]|$)/i.test(text)) {
    return true;
  }

  // Check @username
  const escapedUsername = currentUsername.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (escapedUsername) {
    const userRegex = new RegExp(`@${escapedUsername}(?=[^a-zA-Z0-9_.-]|$)`, 'i');
    if (userRegex.test(text)) {
      return true;
    }
  }

  // Check @displayName if set and different from username
  if (currentDisplayName && currentDisplayName.trim().toLowerCase() !== currentUsername.toLowerCase()) {
    const escapedDisplayName = currentDisplayName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (escapedDisplayName) {
      const displayRegex = new RegExp(`@${escapedDisplayName}(?=[^a-zA-Z0-9_.-]|$)`, 'i');
      if (displayRegex.test(text)) {
        return true;
      }
    }
  }

  return false;
}


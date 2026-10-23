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


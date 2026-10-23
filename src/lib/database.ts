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
}

export interface ChatMessage {
  id: string;
  channelId?: string;
  text: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatar: string | null;
  timestamp: string;
  createdAt: number;
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

  await update(ref(rtdb), updates);
}

/**
 * Partially updates an existing user profile in the Realtime Database.
 */
export async function updateUserProfile(userId: string, partial: Partial<UserProfile>): Promise<void> {
  try {
    const userKey = normalizeKey(userId);
    const userRef = ref(rtdb, `users/${userKey}`);
    await update(userRef, {
      ...partial,
      lastSeen: Date.now()
    });
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
  await set(newMsgRef, message);
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
  await set(newNoteRef, message);
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

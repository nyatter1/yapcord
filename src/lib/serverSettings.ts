import { ref, onValue, set, get } from 'firebase/database';
import { rtdb } from './firebase';
import { cleanUndefined } from './database';

export interface ServerRole {
  id: string;
  name: string;
  color: string;
  isOwner?: boolean;
  hoist?: boolean; // display separately in member list
  mentionable?: boolean;
  position: number;
  permissions: {
    administrator?: boolean;
    manageServer?: boolean;
    manageRoles?: boolean;
    manageChannels?: boolean;
    kickMembers?: boolean;
    banMembers?: boolean;
    manageMessages?: boolean;
    sendMessages?: boolean;
    attachFiles?: boolean;
    mentionEveryone?: boolean;
  };
}

export interface ProfanityFilterConfig {
  enabled: boolean;
  action: 'censor' | 'block';
  customWords: string[];
}

export interface AuditLogEntry {
  id: string;
  action: string;
  actor: string;
  timestamp: number;
}

export interface ServerSettingsData {
  name: string;
  ownerEmail: string;
  ownerUsername?: string;
  description?: string;
  icon?: string | null;
  roles: Record<string, ServerRole>;
  memberRoles: Record<string, string[]>; // username lowercase -> array of role IDs
  profanityFilter: ProfanityFilterConfig;
  auditLog?: AuditLogEntry[];
}

export const DEFAULT_PROFANITY_WORDS: string[] = [
  'fuck', 'fucking', 'fucked', 'fucker',
  'shit', 'shitting', 'bullshit',
  'bitch', 'bitches',
  'asshole', 'ass', 'bastard',
  'dick', 'cock', 'pussy',
  'cunt', 'whore', 'slut',
  'nigger', 'nigga', 'faggot', 'retard'
];

export const DEFAULT_SERVER_SETTINGS: ServerSettingsData = {
  name: 'Yapzo HQ',
  ownerEmail: 'hayden@gmail.com',
  ownerUsername: '',
  description: 'The official home server for Yapzo community.',
  icon: null,
  roles: {
    owner: {
      id: 'owner',
      name: 'Owner',
      color: '#f0b232',
      isOwner: true,
      hoist: true,
      mentionable: true,
      position: 1,
      permissions: {
        administrator: true,
        manageServer: true,
        manageRoles: true,
        manageChannels: true,
        kickMembers: true,
        banMembers: true,
        manageMessages: true,
        sendMessages: true,
        attachFiles: true,
        mentionEveryone: true
      }
    },
    admin: {
      id: 'admin',
      name: 'Admin',
      color: '#e91e63',
      hoist: true,
      mentionable: true,
      position: 2,
      permissions: {
        administrator: false,
        manageServer: true,
        manageRoles: true,
        manageChannels: true,
        kickMembers: true,
        banMembers: true,
        manageMessages: true,
        sendMessages: true,
        attachFiles: true,
        mentionEveryone: true
      }
    },
    moderator: {
      id: 'moderator',
      name: 'Moderator',
      color: '#23a55a',
      hoist: true,
      mentionable: true,
      position: 3,
      permissions: {
        kickMembers: true,
        manageMessages: true,
        sendMessages: true,
        attachFiles: true,
        mentionEveryone: false
      }
    },
    member: {
      id: 'member',
      name: 'Member',
      color: '#949ba4',
      hoist: false,
      mentionable: false,
      position: 4,
      permissions: {
        sendMessages: true,
        attachFiles: true
      }
    }
  },
  memberRoles: {},
  profanityFilter: {
    enabled: true,
    action: 'censor',
    customWords: []
  },
  auditLog: [
    {
      id: 'init-1',
      action: 'Server created with Owner role designated for hayden@gmail.com',
      actor: 'System',
      timestamp: Date.now()
    }
  ]
};

const SETTINGS_REF_PATH = 'server_settings/yapzo_hq';

/**
 * Filter text using profanity settings.
 */
export function filterProfanity(
  text: string,
  config?: ProfanityFilterConfig
): { hasProfanity: boolean; filteredText: string; detectedWords: string[] } {
  if (!config || !config.enabled || !text) {
    return { hasProfanity: false, filteredText: text, detectedWords: [] };
  }

  const allWords = Array.from(
    new Set([...DEFAULT_PROFANITY_WORDS, ...(config.customWords || []).map((w) => w.trim().toLowerCase())])
  ).filter(Boolean);

  let detectedWords: string[] = [];
  let filteredText = text;

  for (const word of allWords) {
    if (!word) continue;
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');

    if (regex.test(filteredText)) {
      detectedWords.push(word);
      if (config.action === 'censor') {
        filteredText = filteredText.replace(regex, (match) => {
          if (match.length <= 2) return '*'.repeat(match.length);
          return match[0] + '*'.repeat(match.length - 2) + match[match.length - 1];
        });
      }
    }
  }

  return {
    hasProfanity: detectedWords.length > 0,
    filteredText,
    detectedWords
  };
}

/**
 * Subscribe to server settings in Firebase RTDB.
 */
export function subscribeToServerSettings(
  callback: (settings: ServerSettingsData) => void
): () => void {
  const settingsRef = ref(rtdb, SETTINGS_REF_PATH);

  const unsubscribe = onValue(settingsRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      // Ensure default roles exist
      const mergedRoles = { ...DEFAULT_SERVER_SETTINGS.roles, ...(data.roles || {}) };
      // Guarantee Owner role exists and is marked as isOwner
      if (!mergedRoles.owner) {
        mergedRoles.owner = DEFAULT_SERVER_SETTINGS.roles.owner;
      } else {
        mergedRoles.owner = {
          ...DEFAULT_SERVER_SETTINGS.roles.owner,
          ...mergedRoles.owner,
          isOwner: true
        };
      }

      const mergedSettings: ServerSettingsData = {
        ...DEFAULT_SERVER_SETTINGS,
        ...data,
        roles: mergedRoles,
        profanityFilter: {
          ...DEFAULT_SERVER_SETTINGS.profanityFilter,
          ...(data.profanityFilter || {})
        },
        memberRoles: data.memberRoles || {}
      };
      callback(mergedSettings);
    } else {
      // Initialize with default settings
      set(settingsRef, cleanUndefined(DEFAULT_SERVER_SETTINGS)).catch((err) => {
        console.warn('Failed to seed default server settings:', err);
      });
      callback(DEFAULT_SERVER_SETTINGS);
    }
  });

  return unsubscribe;
}

/**
 * Save server settings to Firebase RTDB.
 */
export async function saveServerSettings(settings: ServerSettingsData): Promise<void> {
  const settingsRef = ref(rtdb, SETTINGS_REF_PATH);
  await set(settingsRef, cleanUndefined(settings));
}

/**
 * Check if a user is the server Owner or has Administrator permissions.
 */
export function checkUserPermissions(
  userEmail: string,
  username: string,
  settings: ServerSettingsData
): {
  isOwner: boolean;
  isAdmin: boolean;
  canManageServer: boolean;
  canManageRoles: boolean;
  canManageMembers: boolean;
  canManageMessages: boolean;
  roles: ServerRole[];
} {
  const cleanEmail = (userEmail || '').trim().toLowerCase();
  const cleanUser = (username || '').trim().toLowerCase();
  const ownerEmail = (settings.ownerEmail || 'hayden@gmail.com').trim().toLowerCase();

  const isOwner = cleanEmail === ownerEmail || cleanEmail === 'hayden@gmail.com';

  const userRoleIds = settings.memberRoles?.[cleanUser] || [];
  // Owner always gets 'owner' role
  const effectiveRoleIds = isOwner && !userRoleIds.includes('owner')
    ? ['owner', ...userRoleIds]
    : userRoleIds;

  const userRoles = effectiveRoleIds
    .map((rId) => settings.roles[rId])
    .filter(Boolean)
    .sort((a, b) => (a.position || 99) - (b.position || 99));

  if (isOwner) {
    return {
      isOwner: true,
      isAdmin: true,
      canManageServer: true,
      canManageRoles: true,
      canManageMembers: true,
      canManageMessages: true,
      roles: userRoles.length > 0 ? userRoles : [settings.roles.owner]
    };
  }

  const isAdmin = userRoles.some((r) => r.permissions?.administrator);
  const canManageServer = isAdmin || userRoles.some((r) => r.permissions?.manageServer);
  const canManageRoles = isAdmin || userRoles.some((r) => r.permissions?.manageRoles);
  const canManageMembers = isAdmin || userRoles.some((r) => r.permissions?.kickMembers || r.permissions?.banMembers);
  const canManageMessages = isAdmin || userRoles.some((r) => r.permissions?.manageMessages);

  return {
    isOwner: false,
    isAdmin,
    canManageServer,
    canManageRoles,
    canManageMembers,
    canManageMessages,
    roles: userRoles
  };
}

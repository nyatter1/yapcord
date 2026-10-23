import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Shield,
  Users,
  Sliders,
  Plus,
  Trash2,
  Check,
  Search,
  Upload,
  CheckCircle2,
  Loader2,
  Pencil,
  ChevronRight,
  MoreHorizontal,
  UserPlus,
  User,
  SlidersHorizontal
} from 'lucide-react';
import {
  ServerSettingsData,
  ServerRole,
  saveServerSettings,
  PRESET_BANNER_GRADIENTS,
  checkUserPermissions
} from '../lib/serverSettings';
import { UserProfile } from '../lib/database';
import { uploadToCloudinary } from '../lib/cloudinary';

interface ServerSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ServerSettingsData;
  currentUserEmail: string;
  currentUsername: string;
  allUsers: UserProfile[];
  onSettingsUpdated: (updated: ServerSettingsData) => void;
}

type MainTab = 'overview' | 'roles' | 'members';
type RoleSubTab = 'display' | 'permissions' | 'members';

const DISCORD_ROLE_COLORS = [
  '#f0b232', // Gold
  '#2ecc71', // Green
  '#3498db', // Blue
  '#9b59b6', // Purple
  '#e91e63', // Magenta
  '#e67e22', // Orange
  '#e74c3c', // Red
  '#1abc9c', // Teal
  '#95a5a6', // Gray
  '#ffffff'  // White
];

export const ServerSettingsModal: React.FC<ServerSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  currentUserEmail,
  currentUsername,
  allUsers,
  onSettingsUpdated
}) => {
  const [activeTab, setActiveTab] = useState<MainTab>('overview');
  const [localSettings, setLocalSettings] = useState<ServerSettingsData>(settings);

  // Roles management state
  const [rolesViewMode, setRolesViewMode] = useState<'list' | 'edit'>('list');
  const [editingRoleId, setEditingRoleId] = useState<string>('owner');
  const [roleEditTab, setRoleEditTab] = useState<RoleSubTab>('display');
  const [roleSearchQuery, setRoleSearchQuery] = useState('');
  const [permSearchQuery, setPermSearchQuery] = useState('');
  const [memberRoleSearchQuery, setMemberRoleSearchQuery] = useState('');

  // Add members to role modal state
  const [isAddMembersModalOpen, setIsAddMembersModalOpen] = useState(false);
  const [addMembersSelectedUsernames, setAddMembersSelectedUsernames] = useState<string[]>([]);
  const [addMembersSearchQuery, setAddMembersSearchQuery] = useState('');

  // Server Members tab state
  const [memberTableSearchQuery, setMemberTableSearchQuery] = useState('');
  const [showMembersInChannelList, setShowMembersInChannelList] = useState(true);
  const [activeInlineRoleDropdownUser, setActiveInlineRoleDropdownUser] = useState<string | null>(null);

  // Saving / Uploading state
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  const iconFileInputRef = useRef<HTMLInputElement>(null);
  const bannerFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  // ESC key listener to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isAddMembersModalOpen) {
          setIsAddMembersModalOpen(false);
        } else if (activeInlineRoleDropdownUser) {
          setActiveInlineRoleDropdownUser(null);
        } else {
          onClose();
        }
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isAddMembersModalOpen, activeInlineRoleDropdownUser, onClose]);

  const userPerms = checkUserPermissions(currentUserEmail, currentUsername, localSettings);
  const canAccess = userPerms.isOwner || userPerms.canManageServer || userPerms.isAdmin;

  if (!isOpen || !canAccess) return null;

  const handleSave = async (updated = localSettings) => {
    if (!canAccess) return;
    setIsSaving(true);
    setSaveFeedback(null);
    try {
      setLocalSettings(updated);
      await saveServerSettings(updated);
      onSettingsUpdated(updated);
      setSaveFeedback('Changes saved!');
      setTimeout(() => setSaveFeedback(null), 2500);
    } catch (err) {
      console.error('Error saving server settings:', err);
      setSaveFeedback('Failed to save.');
    } finally {
      setIsSaving(false);
    }
  };

  // UPLOAD ICON (IMAGE OR GIF)
  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      const updated: ServerSettingsData = { ...localSettings, icon: url };
      setLocalSettings(updated);
      await handleSave(updated);
    } catch (err) {
      console.error('Failed to upload icon:', err);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  // UPLOAD BANNER (IMAGE OR GIF)
  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      const updated: ServerSettingsData = {
        ...localSettings,
        banner: url,
        bannerType: 'image'
      };
      setLocalSettings(updated);
      await handleSave(updated);
    } catch (err) {
      console.error('Failed to upload banner:', err);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  // ROLE ACTIONS
  const currentEditingRole: ServerRole =
    localSettings.roles[editingRoleId] ||
    Object.values(localSettings.roles)[0] || {
      id: 'member',
      name: 'Member',
      color: '#949ba4',
      position: 1,
      permissions: { sendMessages: true, attachFiles: true }
    };

  const handleCreateRole = () => {
    const roleId = `role_${Date.now()}`;
    const newRole: ServerRole = {
      id: roleId,
      name: 'new role',
      color: '#99aab5',
      hoist: true,
      mentionable: false,
      position: Object.keys(localSettings.roles).length + 1,
      permissions: {
        viewChannels: true,
        sendMessages: true,
        attachFiles: true
      }
    };

    const nextRoles = {
      ...localSettings.roles,
      [roleId]: newRole
    };

    const updated = { ...localSettings, roles: nextRoles };
    setLocalSettings(updated);
    setEditingRoleId(roleId);
    setRolesViewMode('edit');
    setRoleEditTab('display');
    handleSave(updated);
  };

  const handleDeleteRole = (roleId: string) => {
    if (roleId === 'owner') return; // Cannot delete Owner role
    const nextRoles = { ...localSettings.roles };
    delete nextRoles[roleId];

    // Remove this role from all members
    const nextMemberRoles = { ...localSettings.memberRoles };
    for (const u of Object.keys(nextMemberRoles)) {
      nextMemberRoles[u] = (nextMemberRoles[u] || []).filter((id) => id !== roleId);
    }

    const updated = {
      ...localSettings,
      roles: nextRoles,
      memberRoles: nextMemberRoles
    };

    setLocalSettings(updated);
    setEditingRoleId('owner');
    setRolesViewMode('list');
    handleSave(updated);
  };

  const handleUpdateCurrentRole = (fields: Partial<ServerRole>) => {
    if (!currentEditingRole) return;
    const roleId = currentEditingRole.id;
    const isOwnerRole = roleId === 'owner';

    const updatedRole: ServerRole = {
      ...currentEditingRole,
      ...fields,
      ...(isOwnerRole ? { isOwner: true } : {})
    };

    const nextRoles = {
      ...localSettings.roles,
      [roleId]: updatedRole
    };

    const updated = { ...localSettings, roles: nextRoles };
    setLocalSettings(updated);
    handleSave(updated);
  };

  const handleToggleRolePermission = (permKey: keyof ServerRole['permissions']) => {
    if (!currentEditingRole) return;
    if (currentEditingRole.id === 'owner') return; // Owner has all permissions

    const currentPerms = currentEditingRole.permissions || {};
    const updatedPerms = {
      ...currentPerms,
      [permKey]: !currentPerms[permKey]
    };

    handleUpdateCurrentRole({ permissions: updatedPerms });
  };

  const handleClearPermissions = () => {
    if (!currentEditingRole || currentEditingRole.id === 'owner') return;
    handleUpdateCurrentRole({ permissions: {} });
  };

  // MEMBERS ASSIGNED TO CURRENT ROLE
  const getMembersInRole = (roleId: string): UserProfile[] => {
    const list: UserProfile[] = [];
    allUsers.forEach((u) => {
      const uKey = u.username.toLowerCase();
      const roles = localSettings.memberRoles?.[uKey] || [];
      const isOwnerUser =
        (u.email || '').toLowerCase() === (localSettings.ownerEmail || 'hayden@gmail.com').toLowerCase();

      if (roleId === 'owner') {
        if (isOwnerUser || roles.includes('owner')) {
          list.push(u);
        }
      } else if (roles.includes(roleId)) {
        list.push(u);
      } else if (roleId === localSettings.defaultRoleId && roles.length === 0 && !isOwnerUser) {
        list.push(u);
      }
    });
    return list;
  };

  const handleToggleMemberRole = (username: string, roleId: string) => {
    const uKey = username.toLowerCase();
    const currentRoles = localSettings.memberRoles?.[uKey] || [];
    const hasRole = currentRoles.includes(roleId);

    const nextRoles = hasRole
      ? currentRoles.filter((r) => r !== roleId)
      : [...currentRoles, roleId];

    const updated = {
      ...localSettings,
      memberRoles: {
        ...localSettings.memberRoles,
        [uKey]: nextRoles
      }
    };

    setLocalSettings(updated);
    handleSave(updated);
  };

  const handleAddSelectedMembersToRole = () => {
    if (!editingRoleId) return;
    const nextMemberRoles = { ...localSettings.memberRoles };

    addMembersSelectedUsernames.forEach((uname) => {
      const uKey = uname.toLowerCase();
      const current = nextMemberRoles[uKey] || [];
      if (!current.includes(editingRoleId)) {
        nextMemberRoles[uKey] = [...current, editingRoleId];
      }
    });

    const updated = {
      ...localSettings,
      memberRoles: nextMemberRoles
    };

    setLocalSettings(updated);
    handleSave(updated);
    setIsAddMembersModalOpen(false);
    setAddMembersSelectedUsernames([]);
  };

  const sortedRolesList = Object.values(localSettings.roles).sort(
    (a, b) => (a.position || 99) - (b.position || 99)
  );

  const filteredRolesList = sortedRolesList.filter((r) =>
    r.name.toLowerCase().includes(roleSearchQuery.toLowerCase())
  );

  const membersInCurrentRole = getMembersInRole(currentEditingRole.id);
  const filteredRoleMembers = membersInCurrentRole.filter((u) =>
    (u.displayName || u.username).toLowerCase().includes(memberRoleSearchQuery.toLowerCase()) ||
    u.username.toLowerCase().includes(memberRoleSearchQuery.toLowerCase())
  );

  // PERMISSION DEFINITIONS FOR EDIT ROLE -> PERMISSIONS TAB
  const PERMISSIONS_LIST: {
    key: keyof ServerRole['permissions'];
    title: string;
    description: string;
  }[] = [
    {
      key: 'viewChannels',
      title: 'View Channels',
      description: 'Allows members to view channels by default (excluding private channels).'
    },
    {
      key: 'manageChannels',
      title: 'Manage Channels',
      description: 'Allows members to create, edit or delete channels.'
    },
    {
      key: 'manageRoles',
      title: 'Manage Roles',
      description:
        'Allows members to create new roles and edit or delete roles lower than their highest role. Also allows members to change permissions of individual channels that they have access to.'
    },
    {
      key: 'manageServer',
      title: 'Manage Server',
      description: 'Allows members to change server name, icon, banner, and settings.'
    },
    {
      key: 'administrator',
      title: 'Administrator',
      description:
        'Members with this permission have every permission and also bypass channel-specific permissions. This is a dangerous permission to grant.'
    },
    {
      key: 'kickMembers',
      title: 'Kick Members',
      description: 'Allows members to remove other members from this server.'
    },
    {
      key: 'banMembers',
      title: 'Ban Members',
      description: 'Allows members to permanently ban members from this server.'
    },
    {
      key: 'sendMessages',
      title: 'Send Messages',
      description: 'Allows members to send messages in text channels.'
    },
    {
      key: 'manageMessages',
      title: 'Manage Messages',
      description: 'Allows members to delete messages from other members or pin any message.'
    },
    {
      key: 'attachFiles',
      title: 'Attach Files',
      description: 'Allows members to upload files and media in text channels.'
    },
    {
      key: 'mentionEveryone',
      title: 'Mention @everyone',
      description: 'Allows members to use @everyone and notify all users in channels.'
    }
  ];

  const filteredPermissions = PERMISSIONS_LIST.filter(
    (p) =>
      p.title.toLowerCase().includes(permSearchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(permSearchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-[#313338] text-[#dbdee1] flex font-['Inter',system-ui,sans-serif] overflow-hidden select-none">
      {/* 1. LEFT NAVIGATION SIDEBAR (FULLSCREEN DISCORD LAYOUT) */}
      <aside className="w-60 bg-[#2b2d31] flex flex-col justify-between py-10 px-5 flex-shrink-0 border-r border-[#1f2023]">
        <div className="space-y-4">
          {/* Server Name Header */}
          <div className="px-2 pb-2">
            <h2 className="text-[14px] font-bold text-[#f2f3f5] truncate tracking-wide">
              {localSettings.name || 'Yapzo HQ'}
            </h2>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1 text-[14px] font-medium">
            <button
              type="button"
              onClick={() => {
                setActiveTab('overview');
                setRolesViewMode('list');
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-[4px] transition-colors cursor-pointer text-left ${
                activeTab === 'overview'
                  ? 'bg-[#35373c] text-white font-semibold'
                  : 'text-[#949ba4] hover:bg-[#35373c]/50 hover:text-[#dbdee1]'
              }`}
            >
              <span>Server Profile</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('roles');
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-[4px] transition-colors cursor-pointer text-left ${
                activeTab === 'roles'
                  ? 'bg-[#35373c] text-white font-semibold'
                  : 'text-[#949ba4] hover:bg-[#35373c]/50 hover:text-[#dbdee1]'
              }`}
            >
              <span>Roles</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('members');
                setRolesViewMode('list');
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-[4px] transition-colors cursor-pointer text-left ${
                activeTab === 'members'
                  ? 'bg-[#35373c] text-white font-semibold'
                  : 'text-[#949ba4] hover:bg-[#35373c]/50 hover:text-[#dbdee1]'
              }`}
            >
              <span>Members</span>
            </button>
          </nav>
        </div>

        {/* Footer info */}
        <div className="px-2 text-[11px] text-[#80848e]">
          Owner: <span className="text-[#dbdee1] font-medium">{localSettings.ownerEmail}</span>
        </div>
      </aside>

      {/* 2. MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col bg-[#313338] overflow-hidden relative">
        {/* TOP RIGHT DISCORD ESC BUTTON */}
        <div className="absolute top-8 right-10 z-30 flex items-center gap-4">
          {saveFeedback && (
            <span className="text-[12px] text-[#23a55a] font-medium flex items-center gap-1.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4" />
              {saveFeedback}
            </span>
          )}
          <div
            onClick={onClose}
            className="cursor-pointer group flex flex-col items-center gap-1 select-none"
            title="Press ESC to close"
          >
            <div className="w-9 h-9 rounded-full border-2 border-[#b5bac1] group-hover:border-white group-hover:bg-[#232428] flex items-center justify-center text-[#b5bac1] group-hover:text-white transition-all">
              <X className="w-4 h-4 stroke-[2.5]" />
            </div>
            <span className="text-[10px] font-bold text-[#b5bac1] group-hover:text-white tracking-wider">
              ESC
            </span>
          </div>
        </div>

        {/* ======================================================== */}
        {/* VIEW 1: SERVER PROFILE TAB                                */}
        {/* ======================================================== */}
        {activeTab === 'overview' && (
          <div className="flex-1 overflow-y-auto px-10 py-10 max-w-4xl custom-scrollbar">
            <div className="mb-6">
              <h1 className="text-white text-[24px] font-bold mb-1">Server Profile</h1>
              <p className="text-[#949ba4] text-[14px]">
                Customise how your server appears to members and invites.
              </p>
            </div>

            <div className="space-y-6">
              {/* Server Name */}
              <div>
                <label className="block text-[12px] font-bold uppercase text-[#b5bac1] mb-2 tracking-wider">
                  Server Name
                </label>
                <input
                  type="text"
                  value={localSettings.name}
                  onChange={(e) => setLocalSettings({ ...localSettings, name: e.target.value })}
                  className="w-full bg-[#1e1f22] border border-[#232428] rounded-[4px] px-3.5 py-2.5 text-white text-[15px] focus:outline-hidden focus:border-[#5865F2]"
                  placeholder="Server name"
                />
              </div>

              <div className="h-[1px] bg-[#3f4147]" />

              {/* Server Icon */}
              <div>
                <label className="block text-[12px] font-bold uppercase text-[#b5bac1] mb-1 tracking-wider">
                  Server Icon
                </label>
                <p className="text-[13px] text-[#949ba4] mb-3">
                  Upload an image or GIF (at least 512x512).
                </p>

                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-[16px] bg-[#111214] border border-[#232428] overflow-hidden flex items-center justify-center text-white">
                    {localSettings.icon ? (
                      <img src={localSettings.icon} alt="Server Icon" className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-bold text-[18px] text-[#ff6b00]">
                        {(localSettings.name || 'YHQ').slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => iconFileInputRef.current?.click()}
                      disabled={isUploading}
                      className="px-4 py-2 bg-[#5865F2] hover:bg-[#4752c4] text-white font-medium text-[13px] rounded-[4px] transition-colors cursor-pointer flex items-center gap-2"
                    >
                      {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      <span>Change Server Icon</span>
                    </button>

                    {localSettings.icon && (
                      <button
                        type="button"
                        onClick={() => {
                          const updated = { ...localSettings, icon: null };
                          setLocalSettings(updated);
                          handleSave(updated);
                        }}
                        className="px-3 py-2 text-[#f23f43] hover:bg-[#f23f43]/15 font-medium text-[13px] rounded-[4px] transition-colors cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <input
                    type="file"
                    ref={iconFileInputRef}
                    onChange={handleIconUpload}
                    accept="image/*,.gif"
                    className="hidden"
                  />
                </div>
              </div>

              <div className="h-[1px] bg-[#3f4147]" />

              {/* Server Banner */}
              <div>
                <label className="block text-[12px] font-bold uppercase text-[#b5bac1] mb-1 tracking-wider">
                  Server Banner
                </label>
                <p className="text-[13px] text-[#949ba4] mb-3">
                  Shown above the channel list. Upload a custom image/GIF or pick a preset colour.
                </p>

                {/* Banner preview */}
                <div className="w-full h-32 rounded-lg overflow-hidden border border-[#232428] mb-3 relative bg-[#111214]">
                  {localSettings.banner ? (
                    localSettings.bannerType === 'image' ||
                    localSettings.banner.startsWith('http') ||
                    localSettings.banner.startsWith('data:') ? (
                      <img
                        src={localSettings.banner}
                        alt="Server Banner"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full" style={{ background: localSettings.banner }} />
                    )
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#949ba4] text-[13px]">
                      No banner configured
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 mb-4">
                  <button
                    type="button"
                    onClick={() => bannerFileInputRef.current?.click()}
                    disabled={isUploading}
                    className="px-4 py-2 bg-[#5865F2] hover:bg-[#4752c4] text-white font-medium text-[13px] rounded-[4px] transition-colors cursor-pointer flex items-center gap-2"
                  >
                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    <span>Upload Image or GIF</span>
                  </button>

                  {localSettings.banner && (
                    <button
                      type="button"
                      onClick={() => {
                        const updated: ServerSettingsData = { ...localSettings, banner: null };
                        setLocalSettings(updated);
                        handleSave(updated);
                      }}
                      className="px-3 py-2 text-[#f23f43] hover:bg-[#f23f43]/15 font-medium text-[13px] rounded-[4px] transition-colors cursor-pointer"
                    >
                      Remove Banner
                    </button>
                  )}
                  <input
                    type="file"
                    ref={bannerFileInputRef}
                    onChange={handleBannerUpload}
                    accept="image/*,.gif"
                    className="hidden"
                  />
                </div>

                {/* Gradient presets */}
                <div>
                  <span className="block text-[11px] font-bold uppercase text-[#b5bac1] mb-2 tracking-wider">
                    Preset Gradients
                  </span>
                  <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-2">
                    {PRESET_BANNER_GRADIENTS.map((p) => {
                      const isSelected = localSettings.banner === p.style;
                      return (
                        <div
                          key={p.id}
                          onClick={() => {
                            const updated: ServerSettingsData = {
                              ...localSettings,
                              banner: p.style,
                              bannerType: 'gradient'
                            };
                            setLocalSettings(updated);
                            handleSave(updated);
                          }}
                          className={`h-9 rounded-[4px] cursor-pointer transition-transform hover:scale-105 border-2 flex items-center justify-center ${
                            isSelected ? 'border-white shadow-md' : 'border-transparent'
                          }`}
                          style={{ background: p.style }}
                          title={p.label}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="h-[1px] bg-[#3f4147]" />

              {/* Default Role Setting */}
              <div>
                <label className="block text-[12px] font-bold uppercase text-[#b5bac1] mb-1 tracking-wider">
                  Default Role for New Members
                </label>
                <p className="text-[13px] text-[#949ba4] mb-2">
                  Everyone who joins the server automatically gets this role.
                </p>
                <select
                  value={localSettings.defaultRoleId || 'member'}
                  onChange={(e) => {
                    const updated: ServerSettingsData = {
                      ...localSettings,
                      defaultRoleId: e.target.value
                    };
                    setLocalSettings(updated);
                    handleSave(updated);
                  }}
                  className="w-full max-w-md bg-[#1e1f22] border border-[#232428] rounded-[4px] px-3.5 py-2.5 text-white text-[14px] focus:outline-hidden focus:border-[#5865F2] cursor-pointer"
                >
                  {Object.values(localSettings.roles)
                    .filter((r) => r.id !== 'owner')
                    .map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Save Button */}
              <div className="pt-4">
                <button
                  type="button"
                  onClick={() => handleSave(localSettings)}
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-[#5865F2] hover:bg-[#4752c4] text-white font-semibold rounded-[4px] text-[14px] transition-colors cursor-pointer shadow-md"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 2: ROLES TAB                                         */}
        {/* ======================================================== */}
        {activeTab === 'roles' && rolesViewMode === 'list' && (
          <div className="flex-1 overflow-y-auto px-10 py-10 max-w-4xl custom-scrollbar">
            {/* Header matching image_033e3ca0.png */}
            <div className="mb-4">
              <h1 className="text-white text-[24px] font-bold mb-1">Roles</h1>
              <p className="text-[#949ba4] text-[14px]">
                Use roles to group your server members and assign permissions.
              </p>
            </div>

            {/* Default permissions card matching image_033e3ca0.png */}
            <div
              onClick={() => {
                const defaultRole =
                  localSettings.roles[localSettings.defaultRoleId || 'member'] ||
                  Object.values(localSettings.roles)[0];
                if (defaultRole) {
                  setEditingRoleId(defaultRole.id);
                  setRolesViewMode('edit');
                  setRoleEditTab('display');
                }
              }}
              className="bg-[#2b2d31] hover:bg-[#35373c]/70 transition-colors p-4 rounded-lg flex items-center justify-between cursor-pointer border border-[#1f2023] mt-5 mb-6"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-full bg-[#1e1f22] flex items-center justify-center text-[#dbdee1]">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-white font-bold text-[15px]">Default permissions</h4>
                  <p className="text-[13px] text-[#949ba4]">@everyone • applies to all server members</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#949ba4]" />
            </div>

            {/* Search & Create Role Button matching image_033e3ca0.png */}
            <div className="flex items-center gap-3 mb-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#949ba4]" />
                <input
                  type="text"
                  value={roleSearchQuery}
                  onChange={(e) => setRoleSearchQuery(e.target.value)}
                  placeholder="Search Roles"
                  className="w-full bg-[#1e1f22] border border-[#232428] rounded-[4px] pl-10 pr-3 py-2 text-white text-[14px] focus:outline-hidden focus:border-[#5865F2]"
                />
              </div>
              <button
                type="button"
                onClick={handleCreateRole}
                className="px-4 py-2 bg-[#5865F2] hover:bg-[#4752c4] text-white font-semibold text-[14px] rounded-[4px] transition-colors cursor-pointer flex-shrink-0"
              >
                Create Role
              </button>
            </div>

            <p className="text-[12px] text-[#949ba4] mb-6">
              Members use the colour of the highest role they have on this list. Drag roles to reorder them.
            </p>

            {/* Roles Table matching image_033e3ca0.png */}
            <div className="border-t border-[#3f4147] pt-2">
              <div className="flex items-center justify-between text-[12px] font-bold uppercase text-[#b5bac1] py-2 px-3 tracking-wider">
                <span>Roles – {filteredRolesList.length}</span>
                <span className="mr-24">Members</span>
              </div>

              <div className="space-y-1">
                {filteredRolesList.map((role) => {
                  const memberCount = getMembersInRole(role.id).length;
                  const isOwnerRole = role.id === 'owner';

                  return (
                    <div
                      key={role.id}
                      className="flex items-center justify-between px-3 py-2.5 rounded-[4px] hover:bg-[#35373c]/50 transition-colors group cursor-pointer"
                      onClick={() => {
                        setEditingRoleId(role.id);
                        setRolesViewMode('edit');
                        setRoleEditTab('display');
                      }}
                    >
                      {/* Left: Shield icon + Role Name */}
                      <div className="flex items-center gap-3">
                        <Shield className="w-4 h-4 flex-shrink-0" style={{ color: role.color }} />
                        <span className="font-semibold text-[15px]" style={{ color: role.color }}>
                          {role.name}
                        </span>
                      </div>

                      {/* Right: Member count + Edit button + Delete button */}
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-1.5 text-[13px] text-[#949ba4] w-16 justify-end">
                          <span>{memberCount}</span>
                          <User className="w-3.5 h-3.5" />
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingRoleId(role.id);
                              setRolesViewMode('edit');
                              setRoleEditTab('display');
                            }}
                            className="p-1.5 text-[#b5bac1] hover:text-white hover:bg-[#2b2d31] rounded transition-colors cursor-pointer"
                            title="Edit Role"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>

                          {!isOwnerRole && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteRole(role.id);
                              }}
                              className="p-1.5 text-[#949ba4] hover:text-[#f23f43] hover:bg-[#2b2d31] rounded transition-colors cursor-pointer"
                              title="Delete Role"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 2b: EDIT ROLE SUBVIEW                                */}
        {/* (Matching image_904146b2.png, image_15059c79.png, image_d8a891c9.png) */}
        {/* ======================================================== */}
        {activeTab === 'roles' && rolesViewMode === 'edit' && (
          <div className="flex-1 flex overflow-hidden">
            {/* Sub-sidebar on the left: ← Back, +, Role list */}
            <aside className="w-60 bg-[#2b2d31] border-r border-[#1f2023] flex flex-col py-8 px-4 flex-shrink-0">
              <div className="flex items-center justify-between mb-4 px-2">
                <button
                  type="button"
                  onClick={() => setRolesViewMode('list')}
                  className="flex items-center gap-2 text-[14px] font-semibold text-[#dbdee1] hover:text-white transition-colors cursor-pointer"
                >
                  <span>← Back</span>
                </button>
                <button
                  type="button"
                  onClick={handleCreateRole}
                  className="p-1 hover:bg-[#35373c] text-[#b5bac1] hover:text-white rounded transition-colors cursor-pointer"
                  title="Create Role"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Roles list */}
              <div className="space-y-1 overflow-y-auto flex-1 custom-scrollbar">
                {sortedRolesList.map((role) => {
                  const isSelected = role.id === currentEditingRole.id;
                  return (
                    <div
                      key={role.id}
                      onClick={() => setEditingRoleId(role.id)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-[4px] cursor-pointer transition-colors text-[14px] font-medium ${
                        isSelected
                          ? 'bg-[#35373c] text-white font-semibold'
                          : 'text-[#949ba4] hover:bg-[#35373c]/50 hover:text-[#dbdee1]'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: role.color }}
                      />
                      <span className="truncate">{role.name}</span>
                    </div>
                  );
                })}
              </div>
            </aside>

            {/* Right main edit role workspace */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Top sub-header */}
              <div className="px-10 pt-8 pb-4 flex-shrink-0 border-b border-[#232428]">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-white text-[20px] font-bold">
                    Edit Role – {currentEditingRole.name}
                  </h2>
                  <div className="flex items-center gap-2">
                    {currentEditingRole.id !== 'owner' && (
                      <button
                        type="button"
                        onClick={() => handleDeleteRole(currentEditingRole.id)}
                        className="text-[#949ba4] hover:text-[#f23f43] p-1.5 rounded hover:bg-[#232428] transition-colors cursor-pointer"
                        title="Delete Role"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Sub-tabs: Display | Permissions | Manage Members */}
                <div className="flex items-center gap-8 text-[14px] font-medium border-b border-[#35373c]">
                  <button
                    type="button"
                    onClick={() => setRoleEditTab('display')}
                    className={`pb-3 relative transition-colors cursor-pointer ${
                      roleEditTab === 'display' ? 'text-white font-semibold' : 'text-[#949ba4] hover:text-[#dbdee1]'
                    }`}
                  >
                    <span>Display</span>
                    {roleEditTab === 'display' && (
                      <div className="absolute bottom-0 inset-x-0 h-0.5 bg-[#5865F2]" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setRoleEditTab('permissions')}
                    className={`pb-3 relative transition-colors cursor-pointer ${
                      roleEditTab === 'permissions' ? 'text-white font-semibold' : 'text-[#949ba4] hover:text-[#dbdee1]'
                    }`}
                  >
                    <span>Permissions</span>
                    {roleEditTab === 'permissions' && (
                      <div className="absolute bottom-0 inset-x-0 h-0.5 bg-[#5865F2]" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setRoleEditTab('members')}
                    className={`pb-3 relative transition-colors cursor-pointer ${
                      roleEditTab === 'members' ? 'text-white font-semibold' : 'text-[#949ba4] hover:text-[#dbdee1]'
                    }`}
                  >
                    <span>Manage Members ({membersInCurrentRole.length})</span>
                    {roleEditTab === 'members' && (
                      <div className="absolute bottom-0 inset-x-0 h-0.5 bg-[#5865F2]" />
                    )}
                  </button>
                </div>
              </div>

              {/* Sub-tab contents */}
              <div className="flex-1 overflow-y-auto px-10 py-6 max-w-3xl custom-scrollbar">
                {/* 1. DISPLAY TAB (image_904146b2.png) */}
                {roleEditTab === 'display' && (
                  <div className="space-y-6">
                    {/* Role name */}
                    <div>
                      <label className="block text-[12px] font-bold uppercase text-[#b5bac1] mb-2 tracking-wider">
                        Role name <span className="text-[#f23f43]">*</span>
                      </label>
                      <input
                        type="text"
                        value={currentEditingRole.name}
                        disabled={currentEditingRole.id === 'owner'}
                        onChange={(e) => handleUpdateCurrentRole({ name: e.target.value })}
                        className="w-full bg-[#1e1f22] border border-[#232428] rounded-[4px] px-3.5 py-2.5 text-white text-[15px] focus:outline-hidden focus:border-[#5865F2] disabled:opacity-70"
                        placeholder="new role"
                      />
                    </div>

                    {/* Role Style: Solid */}
                    <div>
                      <label className="block text-[12px] font-bold uppercase text-[#b5bac1] mb-2 tracking-wider">
                        Role Style
                      </label>
                      <div className="flex items-center gap-3">
                        <div className="px-5 py-2.5 rounded-[6px] bg-[#1e1f22] border-2 border-[#5865F2] text-white font-semibold text-[14px] flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: currentEditingRole.color }}
                          />
                          <span>Solid</span>
                        </div>
                      </div>
                    </div>

                    {/* Role colour matching image_904146b2.png */}
                    <div>
                      <label className="block text-[12px] font-bold uppercase text-[#b5bac1] mb-1 tracking-wider">
                        Role colour <span className="text-[#f23f43]">*</span>
                      </label>
                      <p className="text-[13px] text-[#949ba4] mb-3">
                        Members use the colour of the highest role they have on the roles list.
                      </p>

                      <div className="flex items-center gap-2.5 flex-wrap">
                        {/* Custom color input swatch */}
                        <div className="relative">
                          <input
                            type="color"
                            value={currentEditingRole.color}
                            onChange={(e) => handleUpdateCurrentRole({ color: e.target.value })}
                            className="w-9 h-9 rounded-[4px] cursor-pointer opacity-0 absolute inset-0 z-10"
                            title="Custom Color"
                          />
                          <div
                            className="w-9 h-9 rounded-[4px] border-2 border-[#3f4147] flex items-center justify-center cursor-pointer hover:border-white transition-colors"
                            style={{ backgroundColor: currentEditingRole.color }}
                          >
                            <Pencil className="w-3.5 h-3.5 text-white drop-shadow" />
                          </div>
                        </div>

                        {/* Preset color swatches */}
                        {DISCORD_ROLE_COLORS.map((col) => {
                          const isSelected = currentEditingRole.color.toLowerCase() === col.toLowerCase();
                          return (
                            <button
                              key={col}
                              type="button"
                              onClick={() => handleUpdateCurrentRole({ color: col })}
                              className={`w-7 h-7 rounded-full transition-transform hover:scale-110 flex items-center justify-center cursor-pointer ${
                                isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-[#313338]' : ''
                              }`}
                              style={{ backgroundColor: col }}
                              title={col}
                            >
                              {isSelected && <Check className="w-3.5 h-3.5 text-black stroke-[3]" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="h-[1px] bg-[#3f4147]" />

                    {/* Hoist toggle */}
                    <div className="flex items-center justify-between py-2">
                      <div>
                        <h4 className="text-white font-semibold text-[15px]">
                          Display role members separately from online members
                        </h4>
                        <p className="text-[13px] text-[#949ba4]">
                          Shows a distinct category for this role in the players online list.
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={currentEditingRole.hoist !== false}
                          onChange={(e) => handleUpdateCurrentRole({ hoist: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-[#4e5058] peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#23a55a]" />
                      </label>
                    </div>

                    {/* Mentionable toggle */}
                    <div className="flex items-center justify-between py-2">
                      <div>
                        <h4 className="text-white font-semibold text-[15px]">
                          Allow anyone to @mention this role
                        </h4>
                        <p className="text-[13px] text-[#949ba4]">
                          Members with this role can be pinged by anyone using @role.
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={currentEditingRole.mentionable === true}
                          onChange={(e) => handleUpdateCurrentRole({ mentionable: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-[#4e5058] peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#23a55a]" />
                      </label>
                    </div>
                  </div>
                )}

                {/* 2. PERMISSIONS TAB (image_15059c79.png) */}
                {roleEditTab === 'permissions' && (
                  <div className="space-y-6">
                    {/* Search permissions */}
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#949ba4]" />
                      <input
                        type="text"
                        value={permSearchQuery}
                        onChange={(e) => setPermSearchQuery(e.target.value)}
                        placeholder="Search permissions"
                        className="w-full bg-[#1e1f22] border border-[#232428] rounded-[4px] pl-10 pr-3 py-2 text-white text-[14px] focus:outline-hidden focus:border-[#5865F2]"
                      />
                    </div>

                    {/* General Server Permissions header */}
                    <div className="flex items-center justify-between pt-2">
                      <h3 className="text-[16px] font-bold text-white">General Server Permissions</h3>
                      {currentEditingRole.id !== 'owner' && (
                        <button
                          type="button"
                          onClick={handleClearPermissions}
                          className="text-[13px] text-[#00a8fc] hover:underline cursor-pointer"
                        >
                          Clear permissions
                        </button>
                      )}
                    </div>

                    {/* Permissions list matching image_15059c79.png */}
                    <div className="space-y-4">
                      {filteredPermissions.map((perm) => {
                        const isOwnerRole = currentEditingRole.id === 'owner';
                        const isGranted = isOwnerRole || !!currentEditingRole.permissions?.[perm.key];

                        return (
                          <div
                            key={perm.key}
                            className="flex items-center justify-between py-3 border-b border-[#35373c]/60"
                          >
                            <div className="pr-4 max-w-lg">
                              <h4 className="text-white font-semibold text-[15px]">{perm.title}</h4>
                              <p className="text-[13px] text-[#949ba4] mt-0.5">{perm.description}</p>
                            </div>

                            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                              <input
                                type="checkbox"
                                checked={isGranted}
                                disabled={isOwnerRole}
                                onChange={() => handleToggleRolePermission(perm.key)}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-[#4e5058] peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#23a55a] peer-disabled:opacity-60" />
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. MANAGE MEMBERS TAB (image_d8a891c9.png) */}
                {roleEditTab === 'members' && (
                  <div className="space-y-6">
                    {/* Search & Add Members button */}
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#949ba4]" />
                        <input
                          type="text"
                          value={memberRoleSearchQuery}
                          onChange={(e) => setMemberRoleSearchQuery(e.target.value)}
                          placeholder="Search Members"
                          className="w-full bg-[#1e1f22] border border-[#232428] rounded-[4px] pl-10 pr-3 py-2 text-white text-[14px] focus:outline-hidden focus:border-[#5865F2]"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAddMembersSelectedUsernames([]);
                          setAddMembersSearchQuery('');
                          setIsAddMembersModalOpen(true);
                        }}
                        className="px-4 py-2 bg-[#5865F2] hover:bg-[#4752c4] text-white font-semibold text-[14px] rounded-[4px] transition-colors cursor-pointer flex-shrink-0"
                      >
                        Add Members
                      </button>
                    </div>

                    {/* Member list or empty state */}
                    {filteredRoleMembers.length === 0 ? (
                      <div className="py-16 flex flex-col items-center justify-center text-center">
                        <Users className="w-12 h-12 text-[#949ba4] mb-3 opacity-60" />
                        <p className="text-[14px] text-[#949ba4]">
                          No members were found.{' '}
                          <button
                            type="button"
                            onClick={() => setIsAddMembersModalOpen(true)}
                            className="text-[#00a8fc] hover:underline cursor-pointer"
                          >
                            Add members to this role.
                          </button>
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1 border-t border-[#35373c] pt-2">
                        {filteredRoleMembers.map((member) => (
                          <div
                            key={member.username}
                            className="flex items-center justify-between px-3 py-2.5 rounded-[4px] hover:bg-[#35373c]/50 transition-colors group"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#111214] overflow-hidden flex items-center justify-center text-white">
                                {member.avatar ? (
                                  <img src={member.avatar} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                  <User className="w-4 h-4 text-[#ff6b00]" />
                                )}
                              </div>
                              <div>
                                <span className="font-semibold text-white text-[14px] block">
                                  {member.displayName || member.username}
                                </span>
                                <span className="text-[12px] text-[#949ba4] block">@{member.username}</span>
                              </div>
                            </div>

                            {/* Remove button */}
                            {currentEditingRole.id !== 'owner' && (
                              <button
                                type="button"
                                onClick={() => handleToggleMemberRole(member.username, currentEditingRole.id)}
                                className="p-1.5 text-[#949ba4] hover:text-[#f23f43] hover:bg-[#2b2d31] rounded transition-colors cursor-pointer"
                                title="Remove member from role"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 3: SERVER MEMBERS TAB                                */}
        {/* (Matching image_25c993ad.png)                             */}
        {/* ======================================================== */}
        {activeTab === 'members' && (
          <div className="flex-1 overflow-y-auto px-10 py-10 custom-scrollbar">
            {/* Header matching image_25c993ad.png */}
            <div className="mb-6">
              <h1 className="text-white text-[24px] font-bold mb-2">Server Members</h1>
              <div>
                <h4 className="text-white font-semibold text-[14px]">Show Members in Channel List</h4>
                <p className="text-[#949ba4] text-[13px] leading-relaxed max-w-2xl">
                  Enabling this will show the members page in the channel list, allowing you to see quickly who's
                  recently joined your server and find any users flagged for unusual activity.
                </p>
              </div>
            </div>

            {/* Search row */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-[16px]">Recent Members</h3>
              <div className="relative w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#949ba4]" />
                <input
                  type="text"
                  value={memberTableSearchQuery}
                  onChange={(e) => setMemberTableSearchQuery(e.target.value)}
                  placeholder="Search by username or ID"
                  className="w-full bg-[#1e1f22] border border-[#232428] rounded-[4px] pl-9 pr-3 py-1.5 text-white text-[13px] focus:outline-hidden focus:border-[#5865F2]"
                />
              </div>
            </div>

            {/* Members table */}
            <div className="border-t border-[#3f4147] overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="text-[#b5bac1] border-b border-[#3f4147]/60 text-[12px] font-bold uppercase tracking-wider">
                    <th className="py-3 px-3 w-10">
                      <input type="checkbox" className="rounded-[3px] accent-[#5865F2] cursor-pointer" />
                    </th>
                    <th className="py-3 px-3">Name</th>
                    <th className="py-3 px-3">Member Since</th>
                    <th className="py-3 px-3">Joined Discord</th>
                    <th className="py-3 px-3">Join Method</th>
                    <th className="py-3 px-3">Roles</th>
                    <th className="py-3 px-3">Signals</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#35373c]/50">
                  {allUsers
                    .filter((u) => {
                      const q = memberTableSearchQuery.toLowerCase();
                      return (
                        u.username.toLowerCase().includes(q) ||
                        (u.displayName || '').toLowerCase().includes(q)
                      );
                    })
                    .map((user) => {
                      const uKey = user.username.toLowerCase();
                      const roleIds = localSettings.memberRoles?.[uKey] || [];
                      const isOwnerUser =
                        (user.email || '').toLowerCase() ===
                        (localSettings.ownerEmail || 'hayden@gmail.com').toLowerCase();

                      const effectiveRoleIds = isOwnerUser && !roleIds.includes('owner')
                        ? ['owner', ...roleIds]
                        : roleIds.length === 0 && localSettings.defaultRoleId
                        ? [localSettings.defaultRoleId]
                        : roleIds;

                      const assignedRoles = effectiveRoleIds
                        .map((rId) => localSettings.roles[rId])
                        .filter(Boolean);

                      const isDropdownOpen = activeInlineRoleDropdownUser === user.username;

                      return (
                        <tr key={user.username} className="hover:bg-[#35373c]/40 transition-colors group">
                          {/* Checkbox */}
                          <td className="py-3 px-3">
                            <input
                              type="checkbox"
                              className="rounded-[3px] accent-[#5865F2] cursor-pointer"
                            />
                          </td>

                          {/* Name */}
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#111214] overflow-hidden flex items-center justify-center text-white">
                                {user.avatar ? (
                                  <img
                                    src={user.avatar}
                                    alt="Avatar"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <User className="w-4 h-4 text-[#ff6b00]" />
                                )}
                              </div>
                              <div>
                                <span className="font-semibold text-white block">
                                  {user.displayName || user.username}
                                </span>
                                <span className="text-[11px] text-[#949ba4] block">
                                  {user.username}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Member Since */}
                          <td className="py-3 px-3 text-[#dbdee1]">
                            18 mins ago
                          </td>

                          {/* Joined Discord */}
                          <td className="py-3 px-3 text-[#dbdee1]">
                            1 year ago
                          </td>

                          {/* Join Method */}
                          <td className="py-3 px-3 text-[#949ba4]">
                            Unknown
                          </td>

                          {/* Roles with + inline add button */}
                          <td className="py-3 px-3 relative">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {assignedRoles.map((r) => (
                                <span
                                  key={r.id}
                                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] text-[12px] font-medium bg-[#1e1f22] border border-[#232428]"
                                >
                                  <span
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: r.color }}
                                  />
                                  <span style={{ color: r.color }}>{r.name}</span>
                                </span>
                              ))}

                              {/* Plus button to toggle roles inline */}
                              <button
                                type="button"
                                onClick={() =>
                                  setActiveInlineRoleDropdownUser(
                                    isDropdownOpen ? null : user.username
                                  )
                                }
                                className="w-5 h-5 rounded-full bg-[#2b2d31] hover:bg-[#35373c] text-[#dbdee1] flex items-center justify-center cursor-pointer transition-colors"
                                title="Add/Remove Role"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Dropdown for role selection */}
                            {isDropdownOpen && (
                              <div className="absolute left-3 top-12 z-40 bg-[#111214] border border-[#232428] rounded-[6px] shadow-2xl p-2 w-48 space-y-1 animate-in fade-in zoom-in-95 duration-100">
                                <span className="text-[11px] font-bold uppercase text-[#949ba4] block px-2 py-1 tracking-wider">
                                  Assign Roles
                                </span>
                                {sortedRolesList.map((r) => {
                                  const hasRole = effectiveRoleIds.includes(r.id);
                                  return (
                                    <div
                                      key={r.id}
                                      onClick={() => handleToggleMemberRole(user.username, r.id)}
                                      className="flex items-center justify-between px-2 py-1.5 rounded-[4px] hover:bg-[#232428] cursor-pointer text-[13px] text-[#dbdee1]"
                                    >
                                      <div className="flex items-center gap-2 truncate">
                                        <span
                                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                          style={{ backgroundColor: r.color }}
                                        />
                                        <span className="truncate">{r.name}</span>
                                      </div>
                                      {hasRole && <Check className="w-3.5 h-3.5 text-[#23a55a]" />}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </td>

                          {/* Signals */}
                          <td className="py-3 px-3 text-[#949ba4]">
                            —
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>

              <div className="py-4 text-[13px] text-[#949ba4]">
                Showing {allUsers.length} member{allUsers.length === 1 ? '' : 's'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 4. "ADD MEMBERS" MODAL (Matching image_a0b388e9.png)       */}
      {/* ======================================================== */}
      {isAddMembersModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/70 flex items-center justify-center p-4 animate-in fade-in duration-100">
          <div className="w-full max-w-md bg-[#313338] rounded-[8px] shadow-2xl border border-[#232428] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-5 pb-3">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-white text-[18px] font-bold">Add members</h3>
                <button
                  type="button"
                  onClick={() => setIsAddMembersModalOpen(false)}
                  className="text-[#949ba4] hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-[13px] text-[#949ba4]">
                Select up to 30 members to add to role <span className="font-semibold text-white">{currentEditingRole.name}</span>
              </p>
            </div>

            {/* Search */}
            <div className="px-5 mb-3">
              <input
                type="text"
                value={addMembersSearchQuery}
                onChange={(e) => setAddMembersSearchQuery(e.target.value)}
                placeholder="Search members"
                className="w-full bg-[#1e1f22] border border-[#232428] rounded-[4px] px-3 py-2 text-white text-[14px] focus:outline-hidden focus:border-[#5865F2]"
              />
            </div>

            {/* Members list */}
            <div className="px-5 py-2 max-h-64 overflow-y-auto space-y-1 custom-scrollbar">
              <span className="text-[11px] font-bold uppercase text-[#b5bac1] block mb-2 tracking-wider">
                Members
              </span>
              {allUsers
                .filter((u) => {
                  const q = addMembersSearchQuery.toLowerCase();
                  return (
                    u.username.toLowerCase().includes(q) ||
                    (u.displayName || '').toLowerCase().includes(q)
                  );
                })
                .map((user) => {
                  const isChecked = addMembersSelectedUsernames.includes(user.username);
                  const isAlreadyInRole = membersInCurrentRole.some((m) => m.username === user.username);

                  return (
                    <div
                      key={user.username}
                      onClick={() => {
                        if (isAlreadyInRole) return;
                        if (isChecked) {
                          setAddMembersSelectedUsernames(
                            addMembersSelectedUsernames.filter((n) => n !== user.username)
                          );
                        } else {
                          setAddMembersSelectedUsernames([...addMembersSelectedUsernames, user.username]);
                        }
                      }}
                      className={`flex items-center gap-3 px-3 py-2 rounded-[4px] cursor-pointer transition-colors ${
                        isAlreadyInRole
                          ? 'opacity-50 cursor-not-allowed'
                          : 'hover:bg-[#35373c]/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked || isAlreadyInRole}
                        disabled={isAlreadyInRole}
                        readOnly
                        className="rounded-[3px] accent-[#5865F2] cursor-pointer"
                      />
                      <div className="w-8 h-8 rounded-full bg-[#111214] overflow-hidden flex items-center justify-center text-white">
                        {user.avatar ? (
                          <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-4 h-4 text-[#ff6b00]" />
                        )}
                      </div>
                      <div className="flex-1 truncate">
                        <span className="font-semibold text-white text-[14px] mr-2">
                          {user.displayName || user.username}
                        </span>
                        <span className="text-[12px] text-[#949ba4]">{user.username}</span>
                      </div>
                      {isAlreadyInRole && (
                        <span className="text-[11px] text-[#949ba4]">Already in role</span>
                      )}
                    </div>
                  );
                })}
            </div>

            {/* Footer buttons */}
            <div className="bg-[#2b2d31] p-4 flex items-center justify-between border-t border-[#232428] mt-3">
              <button
                type="button"
                onClick={() => setIsAddMembersModalOpen(false)}
                className="px-4 py-2 text-white hover:underline text-[14px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddSelectedMembersToRole}
                disabled={addMembersSelectedUsernames.length === 0}
                className="px-6 py-2 bg-[#5865F2] hover:bg-[#4752c4] disabled:opacity-50 text-white font-semibold text-[14px] rounded-[4px] transition-colors cursor-pointer"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

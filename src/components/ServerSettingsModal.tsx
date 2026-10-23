import React, { useState, useRef } from 'react';
import {
  X,
  Shield,
  Users,
  Sliders,
  Crown,
  Plus,
  Trash2,
  Check,
  Search,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  Lock,
  Loader2
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

type TabType = 'overview' | 'roles' | 'members';

const ROLE_COLOR_PALETTE = [
  '#f0b232', // Gold / Owner
  '#e91e63', // Magenta / Admin
  '#23a55a', // Green / Mod
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#f97316', // Orange
  '#06b6d4', // Cyan
  '#949ba4', // Discord Gray
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
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [localSettings, setLocalSettings] = useState<ServerSettingsData>(settings);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('owner');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  const iconFileInputRef = useRef<HTMLInputElement>(null);
  const bannerFileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

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

  // ROLES HANDLERS
  const selectedRole = localSettings.roles[selectedRoleId] || localSettings.roles.owner;

  const handleCreateRole = () => {
    const roleId = `role_${Date.now()}`;
    const newRole: ServerRole = {
      id: roleId,
      name: 'New Role',
      color: '#3b82f6',
      hoist: true,
      mentionable: false,
      position: Object.keys(localSettings.roles).length + 1,
      permissions: {
        sendMessages: true,
        attachFiles: true
      }
    };

    const nextRoles = {
      ...localSettings.roles,
      [roleId]: newRole
    };

    const updated = { ...localSettings, roles: nextRoles };
    setSelectedRoleId(roleId);
    handleSave(updated);
  };

  const handleDeleteRole = (roleId: string) => {
    if (roleId === 'owner') return; // Owner role is permanent
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

    setSelectedRoleId('owner');
    handleSave(updated);
  };

  const handleUpdateCurrentRole = (fields: Partial<ServerRole>) => {
    if (!selectedRole) return;
    const roleId = selectedRole.id;
    const isOwnerRole = roleId === 'owner';

    const updatedRole: ServerRole = {
      ...selectedRole,
      ...fields,
      ...(isOwnerRole ? { isOwner: true } : {})
    };

    const nextRoles = {
      ...localSettings.roles,
      [roleId]: updatedRole
    };

    const updated = { ...localSettings, roles: nextRoles };
    setLocalSettings(updated);
  };

  const handleToggleRolePermission = (permKey: keyof ServerRole['permissions']) => {
    if (!selectedRole) return;
    if (selectedRole.id === 'owner') return;

    const currentPerms = selectedRole.permissions || {};
    const updatedPerms = {
      ...currentPerms,
      [permKey]: !currentPerms[permKey]
    };

    handleUpdateCurrentRole({ permissions: updatedPerms });
  };

  // MEMBERS ROLE ASSIGNMENT
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

    handleSave(updated);
  };

  // Total online members count
  const onlineCount = allUsers.filter((u) => u.status !== 'offline').length;
  const totalMemberCount = allUsers.length || 1;

  return (
    <div className="fixed inset-0 z-50 bg-[#111214]/90 flex items-center justify-center animate-in fade-in duration-150 select-none">
      <div className="w-full h-full max-w-6xl max-h-[880px] bg-[#313338] text-[#dbdee1] rounded-lg shadow-2xl flex overflow-hidden border border-[#232428] relative font-['Inter',system-ui,sans-serif]">
        {/* LEFT SETTINGS SIDEBAR (Discord Style) */}
        <div className="w-60 bg-[#2b2d31] flex flex-col justify-between p-4 flex-shrink-0 border-r border-[#1f2023]">
          <div>
            <div className="px-3 pb-3 mb-2">
              <span className="text-[12px] font-bold text-[#949ba4] uppercase tracking-wider block">
                {localSettings.name || 'Yapzo HQ'}
              </span>
            </div>

            <nav className="space-y-1 text-[14px] font-medium">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-[5px] transition-colors cursor-pointer text-left ${
                  activeTab === 'overview'
                    ? 'bg-[#35373c] text-white font-semibold'
                    : 'text-[#b5bac1] hover:bg-[#35373c]/50 hover:text-white'
                }`}
              >
                <Sliders className="w-4 h-4 text-[#ff6b00]" />
                <span>Server Profile</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('roles')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-[5px] transition-colors cursor-pointer text-left ${
                  activeTab === 'roles'
                    ? 'bg-[#35373c] text-white font-semibold'
                    : 'text-[#b5bac1] hover:bg-[#35373c]/50 hover:text-white'
                }`}
              >
                <Shield className="w-4 h-4 text-[#f0b232]" />
                <span>Roles</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('members')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-[5px] transition-colors cursor-pointer text-left ${
                  activeTab === 'members'
                    ? 'bg-[#35373c] text-white font-semibold'
                    : 'text-[#b5bac1] hover:bg-[#35373c]/50 hover:text-white'
                }`}
              >
                <Users className="w-4 h-4 text-[#3b82f6]" />
                <span>Members</span>
              </button>
            </nav>
          </div>

          {/* Bottom helper */}
          <div className="px-3 py-2 text-[11px] text-[#80848e]">
            Owner: <span className="text-[#f0b232] font-semibold">{localSettings.ownerEmail}</span>
          </div>
        </div>

        {/* RIGHT CONTENT WORKSPACE */}
        <div className="flex-1 flex flex-col bg-[#313338] overflow-hidden relative">
          {/* TOP RIGHT ICONIC ESC BUTTON */}
          <div className="absolute top-6 right-8 z-30 flex items-center gap-4">
            {saveFeedback && (
              <span className="text-[12px] text-[#23a55a] font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {saveFeedback}
              </span>
            )}
            <div
              onClick={onClose}
              className="flex flex-col items-center gap-1 cursor-pointer group select-none"
              title="Press ESC to close"
            >
              <div className="w-8 h-8 rounded-full border-2 border-[#b5bac1] group-hover:border-white group-hover:bg-[#232428] flex items-center justify-center text-[#b5bac1] group-hover:text-white transition-all">
                <X className="w-4 h-4 stroke-[2.5]" />
              </div>
              <span className="text-[10px] font-bold text-[#b5bac1] group-hover:text-white tracking-wider">
                ESC
              </span>
            </div>
          </div>

          {/* TAB CONTENTS */}
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            {/* 1. SERVER PROFILE / OVERVIEW TAB (Matching Image 1) */}
            {activeTab === 'overview' && (
              <div className="max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* Left: Configuration Form */}
                <div className="lg:col-span-7 space-y-6">
                  <div>
                    <h2 className="text-white text-[22px] font-bold mb-1">Server Profile</h2>
                    <p className="text-[#949ba4] text-[13px] leading-relaxed">
                      Customise how your server appears in invite links and, if enabled, in Server Discovery and Announcement Channel messages.
                    </p>
                  </div>

                  {/* Name field */}
                  <div>
                    <label className="block text-[12px] font-bold uppercase text-[#b5bac1] mb-2 tracking-wider">
                      Name
                    </label>
                    <input
                      type="text"
                      value={localSettings.name}
                      onChange={(e) => setLocalSettings({ ...localSettings, name: e.target.value })}
                      className="w-full bg-[#1e1f22] border border-[#232428] rounded-[4px] px-3.5 py-2.5 text-white text-[15px] focus:outline-hidden focus:border-[#ff6b00]"
                      placeholder="Server name"
                    />
                  </div>

                  <div className="h-[1px] bg-[#3f4147]" />

                  {/* Icon section */}
                  <div>
                    <label className="block text-[12px] font-bold uppercase text-[#b5bac1] mb-1 tracking-wider">
                      Icon
                    </label>
                    <p className="text-[12px] text-[#949ba4] mb-3">
                      We recommend an image or GIF of at least 512x512.
                    </p>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => iconFileInputRef.current?.click()}
                        disabled={isUploading}
                        className="px-4 py-2 bg-[#5865f2] hover:bg-[#4752c4] text-white font-medium text-[13px] rounded-[3px] transition-colors cursor-pointer flex items-center gap-2"
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
                          className="px-3 py-2 text-[#f23f43] hover:bg-[#f23f43]/15 font-medium text-[13px] rounded-[3px] transition-colors cursor-pointer"
                        >
                          Remove Icon
                        </button>
                      )}
                    </div>

                    <input
                      type="file"
                      ref={iconFileInputRef}
                      onChange={handleIconUpload}
                      accept="image/*"
                      className="hidden"
                    />
                  </div>

                  <div className="h-[1px] bg-[#3f4147]" />

                  {/* Banner section */}
                  <div>
                    <label className="block text-[12px] font-bold uppercase text-[#b5bac1] mb-1 tracking-wider">
                      Banner
                    </label>
                    <p className="text-[12px] text-[#949ba4] mb-3">
                      Select a gradient color or upload a custom static/GIF banner image for the server.
                    </p>

                    {/* Gradient Swatches (Image 1 replica) */}
                    <div className="grid grid-cols-3 gap-2.5 mb-3">
                      {PRESET_BANNER_GRADIENTS.map((grad) => {
                        const isSelected =
                          localSettings.bannerType === 'gradient' && localSettings.banner === grad.style;

                        return (
                          <div
                            key={grad.id}
                            onClick={() => {
                              const updated: ServerSettingsData = {
                                ...localSettings,
                                banner: grad.style,
                                bannerType: 'gradient'
                              };
                              setLocalSettings(updated);
                              handleSave(updated);
                            }}
                            className={`h-14 rounded-[8px] cursor-pointer transition-all border-2 relative overflow-hidden ${
                              isSelected
                                ? 'border-white ring-2 ring-white/50 scale-[1.02]'
                                : 'border-transparent hover:border-white/50'
                            }`}
                            style={{ background: grad.style }}
                            title={grad.label}
                          >
                            {isSelected && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                                <Check className="w-5 h-5 text-white drop-shadow" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Custom Image / GIF Banner button */}
                    <div className="flex items-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => bannerFileInputRef.current?.click()}
                        disabled={isUploading}
                        className="px-4 py-2 bg-[#2b2d31] hover:bg-[#35373c] text-white font-medium text-[13px] rounded-[3px] border border-[#4e5058] transition-colors cursor-pointer flex items-center gap-2"
                      >
                        <ImageIcon className="w-4 h-4 text-[#ff6b00]" />
                        <span>Upload Custom Banner (Image or GIF)</span>
                      </button>

                      {localSettings.banner && (
                        <button
                          type="button"
                          onClick={() => {
                            const updated: ServerSettingsData = {
                              ...localSettings,
                              banner: null,
                              bannerType: 'gradient'
                            };
                            setLocalSettings(updated);
                            handleSave(updated);
                          }}
                          className="px-3 py-2 text-[#f23f43] hover:bg-[#f23f43]/15 font-medium text-[13px] rounded-[3px] transition-colors cursor-pointer"
                        >
                          Remove Banner
                        </button>
                      )}
                    </div>

                    <input
                      type="file"
                      ref={bannerFileInputRef}
                      onChange={handleBannerUpload}
                      accept="image/*"
                      className="hidden"
                    />
                  </div>

                  <div className="h-[1px] bg-[#3f4147]" />

                  {/* Default Role Setting ("u can change the default role aswell to be member soeveryone who joins get member role.") */}
                  <div>
                    <label className="block text-[12px] font-bold uppercase text-[#b5bac1] mb-1 tracking-wider">
                      Default Role
                    </label>
                    <p className="text-[12px] text-[#949ba4] mb-2">
                      New members who join the server automatically receive this role.
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
                      className="w-full bg-[#1e1f22] border border-[#232428] rounded-[4px] px-3.5 py-2.5 text-white text-[14px] focus:outline-hidden focus:border-[#ff6b00] cursor-pointer"
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

                  {/* Save button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => handleSave(localSettings)}
                      disabled={isSaving}
                      className="px-6 py-2.5 bg-[#ff6b00] hover:bg-[#e55b00] text-white font-semibold rounded-[4px] text-[14px] transition-colors cursor-pointer shadow-md"
                    >
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>

                {/* Right: Live Discord Server Profile Card Preview (Image 1 replica) */}
                <div className="lg:col-span-5 flex flex-col items-center justify-start pt-6">
                  <div className="w-full max-w-[320px]">
                    <span className="block text-[12px] font-bold uppercase text-[#b5bac1] mb-3 tracking-wider">
                      Preview
                    </span>

                    <div className="w-full bg-[#18191c] rounded-[16px] overflow-hidden border border-[#232428] shadow-2xl select-none relative">
                      {/* Banner area */}
                      <div
                        className="h-32 w-full relative overflow-hidden flex items-center justify-center"
                        style={
                          localSettings.banner
                            ? localSettings.bannerType === 'image' || localSettings.banner.startsWith('http') || localSettings.banner.startsWith('data:')
                              ? {
                                  backgroundImage: `url(${localSettings.banner})`,
                                  backgroundSize: 'cover',
                                  backgroundPosition: 'center'
                                }
                              : { background: localSettings.banner }
                            : { background: 'linear-gradient(to bottom, #111214, #2b2d31)' }
                        }
                      >
                        {!localSettings.banner && (
                          <div className="text-[12px] text-white/40 font-medium">No banner set</div>
                        )}
                      </div>

                      {/* Server Icon overlay pill */}
                      <div className="px-4 pb-5 pt-0 relative">
                        <div className="relative -top-7 mb-[-16px]">
                          <div className="w-16 h-16 rounded-[20px] bg-[#111214] ring-4 ring-[#18191c] overflow-hidden flex items-center justify-center text-white shadow-xl">
                            {localSettings.icon ? (
                              <img
                                src={localSettings.icon}
                                alt="Server Icon"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-[#ff6b00] flex items-center justify-center text-white font-bold text-[18px]">
                                {(localSettings.name || 'YHQ')
                                  .split(' ')
                                  .map((n) => n[0])
                                  .join('')
                                  .slice(0, 3)
                                  .toUpperCase()}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Title & Info */}
                        <h4 className="text-white font-bold text-[18px] leading-snug truncate">
                          {localSettings.name || 'Yapzo HQ'}
                        </h4>

                        <div className="flex items-center gap-2 text-[12px] text-[#949ba4] mt-1">
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-[#23a55a]" />
                            <span>{onlineCount} Online</span>
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-[#80848e]" />
                            <span>{totalMemberCount} Member{totalMemberCount === 1 ? '' : 's'}</span>
                          </span>
                        </div>

                        <div className="text-[11px] text-[#80848e] mt-2 font-medium">
                          Est. Oct 2026
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. ROLES TAB */}
            {activeTab === 'roles' && (
              <div className="h-full flex gap-6">
                {/* Roles sidebar */}
                <div className="w-64 flex flex-col flex-shrink-0 border-r border-[#232428] pr-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[12px] font-bold text-[#b5bac1] uppercase tracking-wider">
                      Roles ({Object.keys(localSettings.roles).length})
                    </span>
                    <button
                      type="button"
                      onClick={handleCreateRole}
                      className="p-1 bg-[#ff6b00] hover:bg-[#e55b00] text-white rounded transition-colors cursor-pointer"
                      title="Create Role"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-1 overflow-y-auto flex-1 custom-scrollbar">
                    {Object.values(localSettings.roles)
                      .sort((a, b) => (a.position || 99) - (b.position || 99))
                      .map((role) => {
                        const isSelected = role.id === selectedRoleId;
                        const isOwnerRole = role.id === 'owner' || role.isOwner;

                        return (
                          <div
                            key={role.id}
                            onClick={() => setSelectedRoleId(role.id)}
                            className={`flex items-center justify-between px-3 py-2 rounded-[5px] cursor-pointer transition-colors group ${
                              isSelected
                                ? 'bg-[#404249] text-white font-semibold'
                                : 'text-[#b5bac1] hover:bg-[#35373c] hover:text-white'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 truncate">
                              <div
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: role.color }}
                              />
                              <span className="truncate text-[14px]">{role.name}</span>
                              {isOwnerRole && <Crown className="w-3.5 h-3.5 text-[#f0b232] flex-shrink-0" />}
                            </div>

                            {!isOwnerRole && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteRole(role.id);
                                }}
                                className="opacity-0 group-hover:opacity-100 hover:text-[#ef4444] p-1 text-[#949ba4] transition-all cursor-pointer"
                                title="Delete Role"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Selected Role Editor */}
                <div className="flex-1 overflow-y-auto pr-4 space-y-6">
                  {selectedRole ? (
                    <>
                      <div>
                        <div className="flex items-center justify-between">
                          <h3 className="text-white text-[18px] font-bold flex items-center gap-2">
                            <span>Edit Role:</span>
                            <span style={{ color: selectedRole.color }}>{selectedRole.name}</span>
                            {selectedRole.id === 'owner' && (
                              <span className="text-[11px] bg-[#f0b232]/20 text-[#f0b232] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                <Crown className="w-3 h-3" /> Owner Role
                              </span>
                            )}
                          </h3>

                          {selectedRole.id !== 'owner' && (
                            <button
                              type="button"
                              onClick={() => handleDeleteRole(selectedRole.id)}
                              className="px-3 py-1 text-[12px] text-[#ef4444] hover:bg-[#ef4444]/10 rounded flex items-center gap-1.5 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete Role
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Role Name */}
                      <div>
                        <label className="block text-[12px] font-bold uppercase text-[#b5bac1] mb-2 tracking-wider">
                          Role Name
                        </label>
                        <input
                          type="text"
                          disabled={selectedRole.id === 'owner'}
                          value={selectedRole.name}
                          onChange={(e) => handleUpdateCurrentRole({ name: e.target.value })}
                          className="w-full bg-[#1e1f22] border border-[#232428] rounded-[4px] px-3.5 py-2 text-white text-[14px] focus:outline-hidden focus:border-[#ff6b00] disabled:opacity-60"
                        />
                      </div>

                      {/* Role Color Picker */}
                      <div>
                        <label className="block text-[12px] font-bold uppercase text-[#b5bac1] mb-2 tracking-wider">
                          Role Color
                        </label>
                        <div className="flex flex-wrap items-center gap-2.5 mb-2">
                          {ROLE_COLOR_PALETTE.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => handleUpdateCurrentRole({ color: c })}
                              className={`w-8 h-8 rounded-full cursor-pointer transition-transform flex items-center justify-center border-2 ${
                                selectedRole.color.toLowerCase() === c.toLowerCase()
                                  ? 'border-white scale-110 shadow-md'
                                  : 'border-transparent hover:scale-105'
                              }`}
                              style={{ backgroundColor: c }}
                            >
                              {selectedRole.color.toLowerCase() === c.toLowerCase() && (
                                <Check className="w-4 h-4 text-black drop-shadow" />
                              )}
                            </button>
                          ))}
                          <div className="flex items-center gap-2 ml-2">
                            <span className="text-[12px] text-[#949ba4]">Hex:</span>
                            <input
                              type="text"
                              value={selectedRole.color}
                              onChange={(e) => handleUpdateCurrentRole({ color: e.target.value })}
                              className="w-24 bg-[#1e1f22] border border-[#232428] rounded px-2 py-1 text-white text-[12px] font-mono"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Display Settings */}
                      <div className="bg-[#2b2d31] p-4 rounded-[6px] space-y-3">
                        <label className="flex items-center justify-between cursor-pointer">
                          <div>
                            <span className="text-white text-[14px] font-medium block">
                              Display role members separately from online members (Hoist)
                            </span>
                            <span className="text-[#949ba4] text-[12px]">
                              When enabled, members with this role appear grouped under this role heading in the online member list.
                            </span>
                          </div>
                          <input
                            type="checkbox"
                            checked={selectedRole.hoist ?? true}
                            onChange={(e) => handleUpdateCurrentRole({ hoist: e.target.checked })}
                            className="w-4 h-4 accent-[#ff6b00] cursor-pointer"
                          />
                        </label>
                      </div>

                      {/* Permissions List */}
                      <div>
                        <h4 className="text-[13px] font-bold uppercase text-[#b5bac1] mb-3 tracking-wider">
                          Role Permissions
                        </h4>

                        {selectedRole.id === 'owner' ? (
                          <div className="p-3 bg-[#f0b232]/10 border border-[#f0b232]/30 rounded-[6px] flex items-center gap-3 text-[#f0b232] text-[13px]">
                            <Lock className="w-4 h-4 flex-shrink-0" />
                            <span>
                              The <strong>Owner</strong> role automatically has all administrator and server management permissions enabled.
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {[
                              { key: 'administrator', label: 'Administrator', desc: 'Bypasses all channel and server permissions (Use with caution).' },
                              { key: 'manageServer', label: 'Manage Server', desc: 'Allows editing server name, icon, banner, and overview settings.' },
                              { key: 'manageRoles', label: 'Manage Roles', desc: 'Allows creating, editing, and assigning roles lower than this role.' },
                              { key: 'manageChannels', label: 'Manage Channels', desc: 'Allows creating, editing, and deleting server channels.' },
                              { key: 'kickMembers', label: 'Kick Members', desc: 'Allows kicking members from the server.' },
                              { key: 'banMembers', label: 'Ban Members', desc: 'Allows banning members permanently.' },
                              { key: 'manageMessages', label: 'Manage Messages', desc: 'Allows deleting messages sent by other members in channels.' },
                              { key: 'sendMessages', label: 'Send Messages', desc: 'Allows sending messages in text channels.' },
                              { key: 'attachFiles', label: 'Attach Files & Media', desc: 'Allows sharing images and files in text channels.' },
                              { key: 'mentionEveryone', label: 'Mention @everyone & @here', desc: 'Allows notifying all server members.' }
                            ].map((perm) => {
                              const isChecked = selectedRole.permissions?.[perm.key as keyof ServerRole['permissions']] ?? false;

                              return (
                                <div
                                  key={perm.key}
                                  onClick={() => handleToggleRolePermission(perm.key as any)}
                                  className="flex items-center justify-between p-3 bg-[#2b2d31] hover:bg-[#35373c] rounded-[5px] cursor-pointer transition-colors"
                                >
                                  <div className="pr-4">
                                    <span className="text-white text-[14px] font-medium block">
                                      {perm.label}
                                    </span>
                                    <span className="text-[#949ba4] text-[12px]">
                                      {perm.desc}
                                    </span>
                                  </div>
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {}}
                                    className="w-4 h-4 accent-[#ff6b00] cursor-pointer flex-shrink-0"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Save role changes */}
                      <div className="pt-4 border-t border-[#232428] flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleSave(localSettings)}
                          disabled={isSaving}
                          className="px-5 py-2 bg-[#ff6b00] hover:bg-[#e55b00] text-white font-semibold rounded-[4px] text-[14px] transition-colors cursor-pointer shadow-md"
                        >
                          {isSaving ? 'Saving...' : 'Save Role Changes'}
                        </button>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            )}

            {/* 3. MEMBERS TAB */}
            {activeTab === 'members' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-white text-[20px] font-bold">Manage Server Members</h3>
                    <p className="text-[#949ba4] text-[14px]">
                      View all community members and assign or revoke their server roles.
                    </p>
                  </div>

                  <div className="relative w-64">
                    <Search className="w-4 h-4 text-[#949ba4] absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="Search member..."
                      value={memberSearchQuery}
                      onChange={(e) => setMemberSearchQuery(e.target.value)}
                      className="w-full bg-[#1e1f22] border border-[#232428] rounded-[4px] pl-9 pr-3 py-2 text-white text-[13px] focus:outline-hidden focus:border-[#ff6b00]"
                    />
                  </div>
                </div>

                {/* Members List */}
                <div className="bg-[#2b2d31] rounded-[6px] border border-[#232428] divide-y divide-[#232428] overflow-hidden">
                  {allUsers
                    .filter((u) =>
                      u.username.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
                      (u.displayName || '').toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
                      (u.email || '').toLowerCase().includes(memberSearchQuery.toLowerCase())
                    )
                    .map((user) => {
                      const uKey = user.username.toLowerCase();
                      const isUserOwner =
                        (user.email || '').toLowerCase() === (localSettings.ownerEmail || 'hayden@gmail.com').toLowerCase();

                      const userRoleIds = localSettings.memberRoles?.[uKey] || [];
                      const effectiveRoleIds = isUserOwner && !userRoleIds.includes('owner')
                        ? ['owner', ...userRoleIds]
                        : userRoleIds.length === 0 && localSettings.defaultRoleId
                        ? [localSettings.defaultRoleId]
                        : userRoleIds;

                      return (
                        <div
                          key={user.username}
                          className="p-3.5 flex items-center justify-between hover:bg-[#35373c]/40 transition-colors"
                        >
                          {/* Member info */}
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-full bg-[#1e1f22] overflow-hidden flex items-center justify-center text-white ring-1 ring-[#232428] flex-shrink-0">
                              {user.avatar ? (
                                <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="font-bold text-[#ff6b00]">
                                  {(user.displayName || user.username)[0].toUpperCase()}
                                </span>
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-white text-[14px] truncate">
                                  {user.displayName || user.username}
                                </span>
                                <span className="text-[#949ba4] text-[12px]">@{user.username}</span>
                                {isUserOwner && (
                                  <span className="flex items-center gap-1 text-[11px] bg-[#f0b232]/20 text-[#f0b232] font-bold px-1.5 py-0.5 rounded">
                                    <Crown className="w-3 h-3" /> Owner
                                  </span>
                                )}
                              </div>
                              <p className="text-[12px] text-[#80848e] truncate">{user.email || 'Member'}</p>
                            </div>
                          </div>

                          {/* Role Chips & Add Role Dropdown */}
                          <div className="flex items-center gap-2 flex-wrap justify-end">
                            {effectiveRoleIds.map((rId) => {
                              const r = localSettings.roles[rId];
                              if (!r) return null;
                              return (
                                <span
                                  key={rId}
                                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-[4px] text-[12px] font-medium bg-[#1e1f22] border border-[#35373c]"
                                  style={{ color: r.color }}
                                >
                                  <span
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: r.color }}
                                  />
                                  <span>{r.name}</span>
                                  {!isUserOwner && (
                                    <button
                                      type="button"
                                      onClick={() => handleToggleMemberRole(user.username, rId)}
                                      className="hover:text-white text-[#949ba4] ml-0.5 cursor-pointer"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  )}
                                </span>
                              );
                            })}

                            {/* Add Role button for this member */}
                            {!isUserOwner && (
                              <div className="relative group">
                                <button
                                  type="button"
                                  className="p-1.5 bg-[#1e1f22] hover:bg-[#ff6b00] hover:text-white rounded text-[#949ba4] text-[12px] flex items-center gap-1 transition-colors cursor-pointer"
                                  title="Add Role"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Role</span>
                                </button>

                                <div className="absolute right-0 top-full mt-1 w-48 bg-[#1e1f22] border border-[#232428] rounded-[6px] shadow-2xl p-1 z-50 hidden group-hover:block">
                                  {Object.values(localSettings.roles)
                                    .filter((r) => r.id !== 'owner')
                                    .map((r) => {
                                      const hasRole = userRoleIds.includes(r.id);
                                      return (
                                        <button
                                          key={r.id}
                                          type="button"
                                          onClick={() => handleToggleMemberRole(user.username, r.id)}
                                          className="w-full flex items-center justify-between px-2.5 py-1.5 text-[12px] text-[#dbdee1] hover:bg-[#2b2d31] rounded transition-colors cursor-pointer text-left"
                                        >
                                          <div className="flex items-center gap-2">
                                            <div
                                              className="w-2.5 h-2.5 rounded-full"
                                              style={{ backgroundColor: r.color }}
                                            />
                                            <span>{r.name}</span>
                                          </div>
                                          {hasRole && <Check className="w-3.5 h-3.5 text-[#ff6b00]" />}
                                        </button>
                                      );
                                    })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

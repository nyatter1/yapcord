import React, { useState } from 'react';
import {
  X,
  Shield,
  Users,
  Sliders,
  AlertTriangle,
  Crown,
  Plus,
  Trash2,
  Check,
  Search,
  Eye,
  FileText,
  UserCheck,
  UserX,
  Lock,
  Sparkles,
  Info
} from 'lucide-react';
import {
  ServerSettingsData,
  ServerRole,
  saveServerSettings,
  filterProfanity,
  DEFAULT_PROFANITY_WORDS
} from '../lib/serverSettings';
import { UserProfile } from '../lib/database';

interface ServerSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ServerSettingsData;
  currentUserEmail: string;
  currentUsername: string;
  allUsers: UserProfile[];
  onSettingsUpdated: (updated: ServerSettingsData) => void;
}

type TabType = 'overview' | 'roles' | 'members' | 'profanity' | 'audit';

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
  const [roleSearchQuery, setRoleSearchQuery] = useState('');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [newCustomWord, setNewCustomWord] = useState('');
  const [testerInput, setTesterInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  // Sync state if settings prop changes
  React.useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  if (!isOpen) return null;

  const cleanEmail = (currentUserEmail || '').trim().toLowerCase();
  const isOwner = cleanEmail === 'hayden@gmail.com' || cleanEmail === (localSettings.ownerEmail || '').toLowerCase();

  const handleSave = async (updated = localSettings, logAction?: string) => {
    setIsSaving(true);
    setSaveFeedback(null);
    try {
      const nextSettings: ServerSettingsData = {
        ...updated,
        auditLog: logAction
          ? [
              {
                id: `log_${Date.now()}`,
                action: logAction,
                actor: currentUsername || cleanEmail,
                timestamp: Date.now()
              },
              ...(updated.auditLog || []).slice(0, 40)
            ]
          : updated.auditLog
      };

      setLocalSettings(nextSettings);
      await saveServerSettings(nextSettings);
      onSettingsUpdated(nextSettings);
      setSaveFeedback('Changes saved to server successfully!');
      setTimeout(() => setSaveFeedback(null), 3000);
    } catch (err) {
      console.error('Error saving server settings:', err);
      setSaveFeedback('Failed to save changes.');
    } finally {
      setIsSaving(false);
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
    handleSave(updated, `Created role "New Role"`);
  };

  const handleDeleteRole = (roleId: string) => {
    if (roleId === 'owner') return; // Cannot delete Owner role
    const nextRoles = { ...localSettings.roles };
    const roleName = nextRoles[roleId]?.name || roleId;
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
    handleSave(updated, `Deleted role "${roleName}"`);
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
    if (selectedRole.id === 'owner') return; // Owner has all permissions locked

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

    const roleName = localSettings.roles[roleId]?.name || roleId;
    handleSave(
      updated,
      hasRole
        ? `Removed role "${roleName}" from member @${username}`
        : `Assigned role "${roleName}" to member @${username}`
    );
  };

  // PROFANITY FILTER HANDLERS
  const handleAddCustomWord = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanWord = newCustomWord.trim().toLowerCase();
    if (!cleanWord) return;

    const currentList = localSettings.profanityFilter.customWords || [];
    if (currentList.includes(cleanWord)) {
      setNewCustomWord('');
      return;
    }

    const updatedFilter = {
      ...localSettings.profanityFilter,
      customWords: [...currentList, cleanWord]
    };

    const updated = {
      ...localSettings,
      profanityFilter: updatedFilter
    };

    setNewCustomWord('');
    handleSave(updated, `Added custom blocked word "${cleanWord}" to profanity filter`);
  };

  const handleRemoveCustomWord = (word: string) => {
    const currentList = localSettings.profanityFilter.customWords || [];
    const updatedList = currentList.filter((w) => w.toLowerCase() !== word.toLowerCase());

    const updatedFilter = {
      ...localSettings.profanityFilter,
      customWords: updatedList
    };

    const updated = {
      ...localSettings,
      profanityFilter: updatedFilter
    };

    handleSave(updated, `Removed blocked word "${word}" from profanity filter`);
  };

  // Test live filtering
  const testResult = filterProfanity(testerInput, localSettings.profanityFilter);

  return (
    <div className="fixed inset-0 z-50 bg-[#111214]/90 flex items-center justify-center animate-in fade-in duration-150 select-none">
      <div className="w-full h-full max-w-6xl max-h-[880px] bg-[#313338] text-[#dbdee1] rounded-lg shadow-2xl flex overflow-hidden border border-[#232428] relative">
        {/* LEFT SETTINGS NAVIGATION SIDEBAR */}
        <div className="w-64 bg-[#2b2d31] flex flex-col justify-between p-4 flex-shrink-0 border-r border-[#1f2023]">
          <div>
            <div className="px-3 pb-3 border-b border-[#232428] mb-3">
              <h2 className="text-white font-bold text-[17px] flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#ff6b00]" />
                <span>Server Settings</span>
              </h2>
              <p className="text-[12px] text-[#949ba4] truncate mt-0.5">{localSettings.name}</p>
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
                <span>Overview</span>
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
                <span>Roles & Permissions</span>
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
                <span>Manage Members</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('profanity')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-[5px] transition-colors cursor-pointer text-left ${
                  activeTab === 'profanity'
                    ? 'bg-[#35373c] text-white font-semibold'
                    : 'text-[#b5bac1] hover:bg-[#35373c]/50 hover:text-white'
                }`}
              >
                <AlertTriangle className="w-4 h-4 text-[#ef4444]" />
                <span>Profanity Filter (AutoMod)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('audit')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-[5px] transition-colors cursor-pointer text-left ${
                  activeTab === 'audit'
                    ? 'bg-[#35373c] text-white font-semibold'
                    : 'text-[#b5bac1] hover:bg-[#35373c]/50 hover:text-white'
                }`}
              >
                <FileText className="w-4 h-4 text-[#949ba4]" />
                <span>Audit Log</span>
              </button>
            </nav>
          </div>

          {/* Owner Identity badge */}
          <div className="bg-[#1e1f22] p-3 rounded-[6px] border border-[#2b2d31]">
            <div className="flex items-center gap-2 mb-1">
              <Crown className="w-4 h-4 text-[#f0b232]" />
              <span className="text-[12px] font-bold text-white uppercase tracking-wider">
                Server Owner
              </span>
            </div>
            <p className="text-[12px] text-[#f0b232] font-semibold truncate">
              {localSettings.ownerEmail}
            </p>
            {isOwner && (
              <span className="inline-block mt-1 text-[10px] bg-[#f0b232]/20 text-[#f0b232] px-1.5 py-0.5 rounded font-bold uppercase">
                You are Owner
              </span>
            )}
          </div>
        </div>

        {/* RIGHT CONTENT WORKSPACE */}
        <div className="flex-1 flex flex-col bg-[#313338] overflow-hidden relative">
          {/* TOP HEADER WITH ESC CLOSE BUTTON */}
          <div className="h-14 px-8 border-b border-[#232428] flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-[16px] capitalize">
                {activeTab === 'profanity' ? 'AutoMod Profanity Filter' : activeTab}
              </span>
              {saveFeedback && (
                <span className="text-[12px] text-[#23a55a] font-medium ml-3 animate-in fade-in">
                  ✓ {saveFeedback}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#4e5058] hover:border-white text-[#dbdee1] hover:text-white text-[13px] font-medium transition-colors cursor-pointer group"
              >
                <X className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                <span>ESC</span>
              </button>
            </div>
          </div>

          {/* TAB CONTENTS */}
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            {/* 1. OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="max-w-2xl space-y-6">
                <div>
                  <h3 className="text-white text-[20px] font-bold mb-1">Server Overview</h3>
                  <p className="text-[#949ba4] text-[14px]">
                    Configure high-level server details, branding, and server ownership.
                  </p>
                </div>

                {/* Server Name input */}
                <div>
                  <label className="block text-[12px] font-bold uppercase text-[#b5bac1] mb-2 tracking-wider">
                    Server Name
                  </label>
                  <input
                    type="text"
                    value={localSettings.name}
                    onChange={(e) => setLocalSettings({ ...localSettings, name: e.target.value })}
                    className="w-full bg-[#1e1f22] border border-[#232428] rounded-[4px] px-3.5 py-2.5 text-white text-[14px] focus:outline-hidden focus:border-[#ff6b00]"
                  />
                </div>

                {/* Server Description */}
                <div>
                  <label className="block text-[12px] font-bold uppercase text-[#b5bac1] mb-2 tracking-wider">
                    Server Description
                  </label>
                  <textarea
                    rows={3}
                    value={localSettings.description || ''}
                    onChange={(e) => setLocalSettings({ ...localSettings, description: e.target.value })}
                    className="w-full bg-[#1e1f22] border border-[#232428] rounded-[4px] px-3.5 py-2.5 text-white text-[14px] focus:outline-hidden focus:border-[#ff6b00] resize-none"
                    placeholder="Tell members what this server is about..."
                  />
                </div>

                {/* Owner Card */}
                <div className="bg-[#2b2d31] p-4 rounded-[8px] border border-[#f0b232]/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#f0b232]/20 text-[#f0b232] flex items-center justify-center flex-shrink-0">
                      <Crown className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-[15px]">Server Owner</span>
                        <span className="text-[10px] bg-[#f0b232] text-black font-extrabold px-1.5 py-0.2 rounded-full uppercase">
                          CROWN
                        </span>
                      </div>
                      <p className="text-[13px] text-[#f0b232] font-semibold">{localSettings.ownerEmail}</p>
                      <p className="text-[11px] text-[#949ba4] mt-0.5">
                        Holds absolute server administrative permissions and Owner Role.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Save button */}
                <div className="pt-4 border-t border-[#232428] flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleSave(localSettings, 'Updated Server Overview')}
                    disabled={isSaving}
                    className="px-5 py-2 bg-[#ff6b00] hover:bg-[#e55b00] text-white font-semibold rounded-[4px] text-[14px] transition-colors cursor-pointer shadow-md"
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}

            {/* 2. ROLES & PERMISSIONS TAB */}
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
                            className={`flex items-center justify-between px-3 py-2 rounded-[5px] cursor-pointer transition-colors ${
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
                                className="opacity-0 group-hover:opacity-100 hover:text-[#ef4444] p-1 text-[#949ba4] transition-all"
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

                      {/* Display / Mention Settings */}
                      <div className="bg-[#2b2d31] p-4 rounded-[6px] space-y-3">
                        <label className="flex items-center justify-between cursor-pointer">
                          <div>
                            <span className="text-white text-[14px] font-medium block">
                              Display role members separately
                            </span>
                            <span className="text-[#949ba4] text-[12px]">
                              Shows members in their own category in the online member list.
                            </span>
                          </div>
                          <input
                            type="checkbox"
                            checked={selectedRole.hoist ?? true}
                            onChange={(e) => handleUpdateCurrentRole({ hoist: e.target.checked })}
                            className="w-4 h-4 accent-[#ff6b00] cursor-pointer"
                          />
                        </label>

                        <div className="h-[1px] bg-[#232428]" />

                        <label className="flex items-center justify-between cursor-pointer">
                          <div>
                            <span className="text-white text-[14px] font-medium block">
                              Allow anyone to @mention this role
                            </span>
                            <span className="text-[#949ba4] text-[12px]">
                              Members can ping this role in text channels.
                            </span>
                          </div>
                          <input
                            type="checkbox"
                            checked={selectedRole.mentionable ?? false}
                            onChange={(e) => handleUpdateCurrentRole({ mentionable: e.target.checked })}
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
                              { key: 'manageServer', label: 'Manage Server', desc: 'Allows editing server name, icon, and overview settings.' },
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
                          onClick={() => handleSave(localSettings, `Updated role "${selectedRole.name}"`)}
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

            {/* 3. MANAGE MEMBERS TAB */}
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

            {/* 4. PROFANITY FILTER (AUTOMOD) TAB */}
            {activeTab === 'profanity' && (
              <div className="max-w-2xl space-y-6">
                <div>
                  <h3 className="text-white text-[20px] font-bold mb-1">
                    AutoMod & Profanity Filter
                  </h3>
                  <p className="text-[#949ba4] text-[14px]">
                    Automatically censor profanities and offensive language in all server channels.
                  </p>
                </div>

                {/* Filter Enable Toggle */}
                <div className="bg-[#2b2d31] p-4 rounded-[6px] flex items-center justify-between border border-[#232428]">
                  <div>
                    <span className="text-white text-[15px] font-semibold block">
                      Enable Profanity Filter
                    </span>
                    <span className="text-[#949ba4] text-[13px]">
                      Scans chat messages in real time and enforces moderation rules.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={localSettings.profanityFilter.enabled}
                    onChange={(e) =>
                      setLocalSettings({
                        ...localSettings,
                        profanityFilter: {
                          ...localSettings.profanityFilter,
                          enabled: e.target.checked
                        }
                      })
                    }
                    className="w-5 h-5 accent-[#ff6b00] cursor-pointer"
                  />
                </div>

                {/* Filter Action Mode */}
                <div>
                  <label className="block text-[12px] font-bold uppercase text-[#b5bac1] mb-2 tracking-wider">
                    Moderation Enforcement Action
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div
                      onClick={() =>
                        setLocalSettings({
                          ...localSettings,
                          profanityFilter: { ...localSettings.profanityFilter, action: 'censor' }
                        })
                      }
                      className={`p-3.5 rounded-[6px] border cursor-pointer transition-all ${
                        localSettings.profanityFilter.action === 'censor'
                          ? 'bg-[#ff6b00]/15 border-[#ff6b00] text-white'
                          : 'bg-[#2b2d31] border-[#232428] text-[#949ba4] hover:border-[#4e5058]'
                      }`}
                    >
                      <div className="font-semibold text-[14px] text-white flex items-center justify-between">
                        <span>Censor Words</span>
                        {localSettings.profanityFilter.action === 'censor' && (
                          <Check className="w-4 h-4 text-[#ff6b00]" />
                        )}
                      </div>
                      <p className="text-[12px] text-[#949ba4] mt-1">
                        Replaces profane letters with asterisks (e.g. <code>f***</code>, <code>s***</code>).
                      </p>
                    </div>

                    <div
                      onClick={() =>
                        setLocalSettings({
                          ...localSettings,
                          profanityFilter: { ...localSettings.profanityFilter, action: 'block' }
                        })
                      }
                      className={`p-3.5 rounded-[6px] border cursor-pointer transition-all ${
                        localSettings.profanityFilter.action === 'block'
                          ? 'bg-[#ff6b00]/15 border-[#ff6b00] text-white'
                          : 'bg-[#2b2d31] border-[#232428] text-[#949ba4] hover:border-[#4e5058]'
                      }`}
                    >
                      <div className="font-semibold text-[14px] text-white flex items-center justify-between">
                        <span>Block Send Completely</span>
                        {localSettings.profanityFilter.action === 'block' && (
                          <Check className="w-4 h-4 text-[#ff6b00]" />
                        )}
                      </div>
                      <p className="text-[12px] text-[#949ba4] mt-1">
                        Prevents the message from posting and prompts user to be respectful.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Add Custom Word */}
                <div>
                  <label className="block text-[12px] font-bold uppercase text-[#b5bac1] mb-2 tracking-wider">
                    Add Custom Blocked Word or Phrase
                  </label>
                  <form onSubmit={handleAddCustomWord} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Type a word to blacklist..."
                      value={newCustomWord}
                      onChange={(e) => setNewCustomWord(e.target.value)}
                      className="flex-1 bg-[#1e1f22] border border-[#232428] rounded-[4px] px-3.5 py-2 text-white text-[13px] focus:outline-hidden focus:border-[#ff6b00]"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-[#ff6b00] hover:bg-[#e55b00] text-white font-medium rounded-[4px] text-[13px] transition-colors cursor-pointer"
                    >
                      Add Word
                    </button>
                  </form>
                </div>

                {/* Custom Words Chips */}
                {localSettings.profanityFilter.customWords?.length > 0 && (
                  <div>
                    <label className="block text-[12px] font-bold uppercase text-[#b5bac1] mb-2 tracking-wider">
                      Custom Blacklisted Words ({localSettings.profanityFilter.customWords.length})
                    </label>
                    <div className="flex flex-wrap gap-1.5 p-3 bg-[#2b2d31] rounded-[6px] border border-[#232428]">
                      {localSettings.profanityFilter.customWords.map((word) => (
                        <span
                          key={word}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1e1f22] text-[#ef4444] text-[12px] font-medium border border-[#35373c]"
                        >
                          <span>{word}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomWord(word)}
                            className="hover:text-white cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Default words preview */}
                <div>
                  <div className="flex items-center gap-1.5 text-[12px] text-[#949ba4] mb-1">
                    <Info className="w-3.5 h-3.5 text-[#ff6b00]" />
                    <span>Includes standard dictionary of {DEFAULT_PROFANITY_WORDS.length}+ standard swear and offensive terms.</span>
                  </div>
                </div>

                {/* Live Tester Sandbox */}
                <div className="p-4 bg-[#1e1f22] rounded-[8px] border border-[#232428] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-[#ff6b00]" />
                      Live Profanity Filter Tester
                    </span>
                    {testResult.hasProfanity && (
                      <span className="text-[11px] text-[#ef4444] bg-[#ef4444]/15 px-2 py-0.5 rounded font-bold uppercase">
                        Profanity Detected: {testResult.detectedWords.join(', ')}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Type a test phrase to see real-time filter action..."
                    value={testerInput}
                    onChange={(e) => setTesterInput(e.target.value)}
                    className="w-full bg-[#2b2d31] border border-[#35373c] rounded px-3 py-2 text-white text-[13px]"
                  />
                  {testerInput && (
                    <div className="text-[12px] pt-1">
                      <span className="text-[#949ba4]">Result: </span>
                      <span className="font-mono text-white bg-[#111214] px-2 py-1 rounded">
                        {testResult.filteredText}
                      </span>
                    </div>
                  )}
                </div>

                {/* Save button */}
                <div className="pt-4 border-t border-[#232428] flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleSave(localSettings, 'Updated Profanity Filter settings')}
                    disabled={isSaving}
                    className="px-5 py-2 bg-[#ff6b00] hover:bg-[#e55b00] text-white font-semibold rounded-[4px] text-[14px] transition-colors cursor-pointer shadow-md"
                  >
                    {isSaving ? 'Saving...' : 'Save Filter Settings'}
                  </button>
                </div>
              </div>
            )}

            {/* 5. AUDIT LOG TAB */}
            {activeTab === 'audit' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-white text-[20px] font-bold">Server Audit Log</h3>
                  <p className="text-[#949ba4] text-[14px]">
                    Chronological record of administrative modifications to roles, permissions, and filters.
                  </p>
                </div>

                <div className="bg-[#2b2d31] rounded-[6px] border border-[#232428] divide-y divide-[#232428] overflow-hidden">
                  {localSettings.auditLog && localSettings.auditLog.length > 0 ? (
                    localSettings.auditLog.map((log) => (
                      <div key={log.id} className="p-3.5 flex items-center justify-between text-[13px]">
                        <div>
                          <p className="text-white font-medium">{log.action}</p>
                          <p className="text-[11px] text-[#949ba4] mt-0.5">
                            By <span className="text-[#ff6b00] font-semibold">@{log.actor}</span>
                          </p>
                        </div>
                        <span className="text-[11px] text-[#80848e]">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 text-center text-[#949ba4] text-[13px]">
                      No audit log events recorded yet.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

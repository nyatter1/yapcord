import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Trash2, Loader2, Link2, Clock, Users, Infinity as InfinityIcon } from 'lucide-react';
import { ServerInvite, subscribeToServerInvites, createInvite, revokeInvite } from '../lib/database';

interface InviteManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverId: string;
  serverName: string;
  currentUsername: string;
}

export const InviteManagerModal: React.FC<InviteManagerModalProps> = ({
  isOpen,
  onClose,
  serverId,
  serverName,
  currentUsername
}) => {
  const [invites, setInvites] = useState<ServerInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [expireHours, setExpireHours] = useState<number | null>(null);
  const [maxUses, setMaxUses] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen || !serverId) return;
    setLoading(true);
    const unsubscribe = subscribeToServerInvites(serverId, (invs) => {
      setInvites(invs);
      setLoading(false);
    });
    return unsubscribe;
  }, [isOpen, serverId]);

  if (!isOpen) return null;

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      await createInvite(serverId, currentUsername, {
        expiresInHours: expireHours,
        maxUses: maxUses
      });
      setExpireHours(null);
      setMaxUses(null);
    } catch (err) {
      console.error('Error creating invite:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = (code: string) => {
    const url = `${window.location.origin}/invite/${code}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    });
  };

  const handleRevoke = async (code: string) => {
    try {
      await revokeInvite(serverId, code);
    } catch (err) {
      console.error('Error revoking invite:', err);
    }
  };

  const formatExpiry = (expiresAt: number | null) => {
    if (expiresAt === null) return 'Never';
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) return 'Expired';
    const hours = Math.floor(remaining / 3600000);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days} day${days === 1 ? '' : 's'} left`;
    if (hours > 0) return `${hours} hour${hours === 1 ? '' : 's'} left`;
    const mins = Math.floor(remaining / 60000);
    return `${mins} min left`;
  };

  const formatUses = (invite: ServerInvite) => {
    if (invite.maxUses === null) return `${invite.uses} used`;
    return `${invite.uses} / ${invite.maxUses}`;
  };

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[560px] max-h-[85vh] bg-[#18191c] border border-[#232428] rounded-[8px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-3 border-b border-[#232428] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Link2 className="w-5 h-5 text-[#ff6b00]" />
            <h2 className="text-white font-bold text-[20px]">Invite Friends</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full text-[#949ba4] hover:text-white hover:bg-[#232428] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Create invite section */}
        <div className="px-6 py-4 border-b border-[#232428] bg-[#141517]">
          <p className="text-[#b5bac1] text-[13px] font-bold uppercase tracking-wider mb-3">
            Generate New Invite Link
          </p>

          <div className="flex flex-col gap-3">
            {/* Expiry selector */}
            <div>
              <label className="block text-[11px] font-bold text-[#949ba4] uppercase tracking-wider mb-1.5">
                Expires After
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { label: '30 min', value: 0.5 },
                  { label: '1 hour', value: 1 },
                  { label: '6 hours', value: 6 },
                  { label: '1 day', value: 24 },
                  { label: '7 days', value: 168 },
                  { label: 'Never', value: null }
                ].map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setExpireHours(opt.value)}
                    className={`px-3 py-1.5 rounded-[4px] text-[12px] font-medium transition-colors cursor-pointer ${
                      expireHours === opt.value
                        ? 'bg-[#ff6b00] text-white'
                        : 'bg-[#2b2d31] text-[#dbdee1] hover:bg-[#35373c]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Max uses selector */}
            <div>
              <label className="block text-[11px] font-bold text-[#949ba4] uppercase tracking-wider mb-1.5">
                Max Uses
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { label: '1', value: 1 },
                  { label: '5', value: 5 },
                  { label: '10', value: 10 },
                  { label: 'No limit', value: null }
                ].map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setMaxUses(opt.value)}
                    className={`px-3 py-1.5 rounded-[4px] text-[12px] font-medium transition-colors cursor-pointer ${
                      maxUses === opt.value
                        ? 'bg-[#ff6b00] text-white'
                        : 'bg-[#2b2d31] text-[#dbdee1] hover:bg-[#35373c]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={isCreating}
              onClick={handleCreate}
              className="px-4 h-9 bg-[#23a55a] hover:bg-[#1f9350] active:bg-[#1a7f45] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-[14px] rounded-[3px] transition-colors cursor-pointer flex items-center justify-center gap-2 mt-1"
            >
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              {isCreating ? 'Generating...' : 'Generate Invite Link'}
            </button>
          </div>
        </div>

        {/* Active invites list */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          <p className="text-[#b5bac1] text-[13px] font-bold uppercase tracking-wider mb-3">
            Active Invites ({invites.length})
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-[#949ba4] animate-spin" />
            </div>
          ) : invites.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Link2 className="w-8 h-8 text-[#4e5058] mb-2" />
              <p className="text-[#949ba4] text-[14px]">No active invites yet.</p>
              <p className="text-[#80848e] text-[12px] mt-1">Generate one above to invite friends!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {invites.map((invite) => {
                const isExpired = invite.expiresAt !== null && Date.now() > invite.expiresAt;
                const isExhausted = invite.maxUses !== null && invite.uses >= invite.maxUses;
                const isDead = isExpired || isExhausted;

                return (
                  <div
                    key={invite.code}
                    className={`bg-[#111214] border rounded-[6px] p-3 flex items-center gap-3 transition-colors ${
                      isDead ? 'border-[#f23f43]/30 opacity-60' : 'border-[#232428]'
                    }`}
                  >
                    {/* Code display */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <code className="text-white font-mono text-[14px] font-semibold bg-[#2b2d31] px-2 py-0.5 rounded-[3px]">
                          {invite.code}
                        </code>
                        <button
                          type="button"
                          onClick={() => handleCopy(invite.code)}
                          className="text-[#949ba4] hover:text-white transition-colors cursor-pointer p-1"
                          title="Copy invite link"
                        >
                          {copiedCode === invite.code ? (
                            <Check className="w-4 h-4 text-[#23a55a]" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-[#949ba4]">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatExpiry(invite.expiresAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {formatUses(invite)}
                        </span>
                        <span className="text-[#80848e]">
                          by @{invite.createdBy}
                        </span>
                      </div>
                    </div>

                    {/* Revoke button */}
                    <button
                      type="button"
                      onClick={() => handleRevoke(invite.code)}
                      className="p-2 text-[#f23f43] hover:bg-[#f23f43]/15 rounded-[4px] transition-colors cursor-pointer flex-shrink-0"
                      title="Revoke invite"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-6 py-3 border-t border-[#232428] bg-[#141517]">
          <p className="text-[12px] text-[#949ba4] flex items-center gap-1.5">
            <InfinityIcon className="w-3.5 h-3.5 text-[#ff6b00]" />
            Invite links work as <code className="text-[#dbdee1]">/invite/CODE</code> URLs. Share them with friends to let them join {serverName}.
          </p>
        </div>
      </div>
    </div>
  );
};

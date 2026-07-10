/**
 * Sidebar — Conversation Library
 * Full-featured conversation management:
 * Folders, Search, Favorites, Pin, Archive, Tags, Recycle Bin, Import/Export, Settings
 */
import React, { useState, useRef, useCallback, useEffect } from "react";
import useConversationStore, { type ConversationFolder, type ConversationTag, type ConversationFilter } from "../../store/useConversationStore";
import type { Conversation } from "../../lib/api/types";

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
  onNewChat: () => void;
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);
const SearchIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);
const StarIcon = ({ filled }: { filled?: boolean }) => (
  <svg className="w-3.5 h-3.5" fill={filled ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
  </svg>
);
const PinIcon = ({ filled }: { filled?: boolean }) => (
  <svg className="w-3.5 h-3.5" fill={filled ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
  </svg>
);
const ArchiveIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
  </svg>
);
const TrashIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);
const FolderIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
  </svg>
);
const TagIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
  </svg>
);
const ExportIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);
const ImportIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);
const CollapseIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
  </svg>
);
const MoreIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
  </svg>
);
const EditIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);
const RestoreIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);
const CheckIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);
const XIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// ─── Conversation Context Menu ────────────────────────────────────────────────
interface ConvMenuProps {
  conv: Conversation;
  folders: ConversationFolder[];
  tags: ConversationTag[];
  onClose: () => void;
}

const ConversationContextMenu: React.FC<ConvMenuProps> = ({ conv, folders, tags, onClose }) => {
  const {
    pinConversation, favoriteConversation, archiveConversation,
    deleteConversation, moveToFolder, addTagToConversation,
    removeTagFromConversation, exportConversation,
    updateConversationTitle,
  } = useConversationStore();
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [showExportPicker, setShowExportPicker] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(conv.title);

  const handleRename = () => {
    if (titleValue.trim() && titleValue !== conv.title) {
      updateConversationTitle(conv.id, titleValue.trim());
    }
    setEditingTitle(false);
    onClose();
  };

  return (
    <div className="absolute left-0 top-full mt-1 z-50 w-52 bg-ink-800 border border-ink-700 rounded-xl shadow-2xl py-1 text-sm">
      {editingTitle ? (
        <div className="px-3 py-2 flex gap-1">
          <input
            autoFocus
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
              if (e.key === "Escape") { setEditingTitle(false); onClose(); }
            }}
            className="flex-1 bg-ink-700 border border-ink-600 rounded px-2 py-1 text-xs text-ink-100 focus:outline-none focus:border-blue-500"
          />
          <button onClick={handleRename} className="p-1 text-green-400 hover:text-green-300"><CheckIcon /></button>
          <button onClick={() => { setEditingTitle(false); onClose(); }} className="p-1 text-ink-400 hover:text-ink-200"><XIcon /></button>
        </div>
      ) : (
        <>
          <button onClick={() => setEditingTitle(true)}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-ink-700 text-ink-300 hover:text-white transition-colors text-xs">
            <EditIcon /> Rename
          </button>
          <button onClick={() => { pinConversation(conv.id, !conv.isPinned); onClose(); }}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-ink-700 text-ink-300 hover:text-white transition-colors text-xs">
            <PinIcon filled={conv.isPinned} /> {conv.isPinned ? "Unpin" : "Pin"}
          </button>
          <button onClick={() => { favoriteConversation(conv.id, !conv.isFavorite); onClose(); }}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-ink-700 text-ink-300 hover:text-white transition-colors text-xs">
            <StarIcon filled={conv.isFavorite} /> {conv.isFavorite ? "Unfavorite" : "Favorite"}
          </button>
          <div className="border-t border-ink-700 my-1" />
          {/* Move to folder */}
          <div className="relative">
            <button onClick={() => { setShowFolderPicker(!showFolderPicker); setShowTagPicker(false); setShowExportPicker(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-ink-700 text-ink-300 hover:text-white transition-colors text-xs">
              <FolderIcon /> Move to Folder
            </button>
            {showFolderPicker && (
              <div className="absolute left-full top-0 ml-1 w-44 bg-ink-800 border border-ink-700 rounded-lg shadow-xl py-1 z-50">
                <button onClick={() => { moveToFolder(conv.id, null); onClose(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-ink-700 text-ink-400 hover:text-white text-xs transition-colors">
                  No folder
                </button>
                {folders.map((f) => (
                  <button key={f.id} onClick={() => { moveToFolder(conv.id, f.id); onClose(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-ink-700 text-ink-300 hover:text-white text-xs transition-colors">
                    <span style={{ color: f.color }}>{f.icon}</span> {f.name}
                    {conv.folderId === f.id && <CheckIcon />}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Tags */}
          <div className="relative">
            <button onClick={() => { setShowTagPicker(!showTagPicker); setShowFolderPicker(false); setShowExportPicker(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-ink-700 text-ink-300 hover:text-white transition-colors text-xs">
              <TagIcon /> Tags
            </button>
            {showTagPicker && (
              <div className="absolute left-full top-0 ml-1 w-44 bg-ink-800 border border-ink-700 rounded-lg shadow-xl py-1 z-50">
                {tags.length === 0 && (
                  <p className="px-3 py-2 text-xs text-ink-500">No tags yet</p>
                )}
                {tags.map((t) => {
                  const hasTag = (conv.tags ?? []).includes(t.id);
                  return (
                    <button key={t.id}
                      onClick={() => { hasTag ? removeTagFromConversation(conv.id, t.id) : addTagToConversation(conv.id, t.id); }}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-ink-700 text-ink-300 hover:text-white text-xs transition-colors">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                      {t.name}
                      {hasTag && <CheckIcon />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="border-t border-ink-700 my-1" />
          {/* Export */}
          <div className="relative">
            <button onClick={() => { setShowExportPicker(!showExportPicker); setShowFolderPicker(false); setShowTagPicker(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-ink-700 text-ink-300 hover:text-white transition-colors text-xs">
              <ExportIcon /> Export
            </button>
            {showExportPicker && (
              <div className="absolute left-full top-0 ml-1 w-36 bg-ink-800 border border-ink-700 rounded-lg shadow-xl py-1 z-50">
                {(["json", "md", "txt"] as const).map((fmt) => (
                  <button key={fmt} onClick={() => { exportConversation(conv.id, fmt); onClose(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-ink-700 text-ink-300 hover:text-white text-xs transition-colors uppercase">
                    {fmt}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => { archiveConversation(conv.id, !conv.isArchived); onClose(); }}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-ink-700 text-ink-300 hover:text-white transition-colors text-xs">
            <ArchiveIcon /> {conv.isArchived ? "Unarchive" : "Archive"}
          </button>
          <div className="border-t border-ink-700 my-1" />
          <button onClick={() => { deleteConversation(conv.id); onClose(); }}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-900/40 text-red-400 hover:text-red-300 transition-colors text-xs">
            <TrashIcon /> Delete
          </button>
        </>
      )}
    </div>
  );
};

// ─── Conversation Item ────────────────────────────────────────────────────────
interface ConvItemProps {
  conv: Conversation;
  isActive: boolean;
  folders: ConversationFolder[];
  tags: ConversationTag[];
  onSelect: () => void;
}

const ConversationItem: React.FC<ConvItemProps> = ({ conv, isActive, folders, tags, onSelect }) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  const folder = conv.folderId ? folders.find((f) => f.id === conv.folderId) : null;
  const convTags = tags.filter((t) => (conv.tags ?? []).includes(t.id));

  return (
    <div
      className={`group relative flex items-start gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
        isActive ? "bg-ink-700 text-ink-100" : "hover:bg-ink-800/70 text-ink-400 hover:text-ink-200"
      }`}
      onClick={onSelect}
    >
      {conv.isPinned && (
        <span className="absolute top-1.5 right-8 text-blue-400 opacity-60">
          <PinIcon filled />
        </span>
      )}
      {conv.isFavorite && (
        <span className="absolute top-1.5 right-14 text-yellow-400 opacity-70">
          <StarIcon filled />
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate leading-tight">{conv.title}</p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {folder && (
            <span className="text-[9px] flex items-center gap-0.5" style={{ color: folder.color }}>
              {folder.icon} {folder.name}
            </span>
          )}
          {convTags.slice(0, 2).map((t) => (
            <span key={t.id} className="text-[9px] px-1 rounded" style={{ backgroundColor: t.color + "33", color: t.color }}>
              {t.name}
            </span>
          ))}
          <span className="text-[9px] text-ink-600 ml-auto">
            {new Date(conv.updatedAt).toLocaleDateString([], { month: "short", day: "numeric" })}
          </span>
        </div>
      </div>
      <div ref={menuRef} className="relative flex-shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-ink-600 text-ink-400 hover:text-ink-200 transition-all"
        >
          <MoreIcon />
        </button>
        {showMenu && (
          <ConversationContextMenu
            conv={conv}
            folders={folders}
            tags={tags}
            onClose={() => setShowMenu(false)}
          />
        )}
      </div>
    </div>
  );
};

// ─── Sidebar Section Type ─────────────────────────────────────────────────────
type SidebarSection = "conversations" | "folders" | "tags" | "settings";

// ─── Main Sidebar ─────────────────────────────────────────────────────────────
const Sidebar: React.FC<SidebarProps> = ({ open, onToggle, onNewChat }) => {
  const {
    conversations, folders, tags,
    activeConversationId, searchQuery, activeFilter, activeFolderId, activeTagId,
    setActiveConversation, setSearchQuery, setActiveFilter, setActiveFolderId, setActiveTagId,
    createFolder, deleteFolder,
    createTag, deleteTag,
    emptyRecycleBin, restoreConversation, permanentlyDeleteConversation,
    exportAll, importConversations,
    getFilteredConversations,
  } = useConversationStore();

  const [section, setSection] = useState<SidebarSection>("conversations");
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewTagInput, setShowNewTagInput] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  const filteredConversations = getFilteredConversations();
  const deletedCount = conversations.filter((c) => c.isDeleted).length;

  const handleNewChat = useCallback(() => {
    onNewChat();
  }, [onNewChat]);

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target?.result as string;
      const result = importConversations(data);
      if ((result.errors ?? []).length > 0) {
        setImportError(`Imported ${result.imported}, errors: ${(result.errors ?? []).join("; ")}`);
      } else {
        setImportError(null);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }, [importConversations]);

  const handleCreateFolder = useCallback(() => {
    if (newFolderName.trim()) {
      createFolder(newFolderName.trim());
      setNewFolderName("");
      setShowNewFolderInput(false);
    }
  }, [newFolderName, createFolder]);

  const handleCreateTag = useCallback(() => {
    if (newTagName.trim()) {
      createTag(newTagName.trim());
      setNewTagName("");
      setShowNewTagInput(false);
    }
  }, [newTagName, createTag]);

  const filterButtons: Array<{ filter: ConversationFilter; label: string; icon: React.ReactNode }> = [
    { filter: "all", label: "All", icon: <span className="text-xs">💬</span> },
    { filter: "pinned", label: "Pinned", icon: <PinIcon /> },
    { filter: "favorites", label: "Fav", icon: <StarIcon /> },
    { filter: "today", label: "Today", icon: <span className="text-xs">📅</span> },
    { filter: "archived", label: "Arch", icon: <ArchiveIcon /> },
    { filter: "deleted", label: "Trash", icon: <TrashIcon /> },
  ];

  return (
    <aside
      className={`${
        open ? "w-72" : "w-0"
      } transition-all duration-300 ease-in-out flex-shrink-0 border-r border-ink-800 bg-ink-900/90 backdrop-blur-xl overflow-hidden`}
    >
      <div className="w-72 h-full flex flex-col">
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-ink-800/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-900/30 text-sm">
              O
            </div>
            <span className="font-bold tracking-tight text-ink-100">Omni One</span>
          </div>
          <button onClick={onToggle} className="p-1.5 rounded-lg hover:bg-ink-800 text-ink-500 hover:text-ink-300 transition-colors">
            <CollapseIcon />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="px-3 pt-3 pb-2">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 transition-colors text-sm font-medium text-white shadow-lg shadow-blue-900/20"
          >
            <PlusIcon />
            New Chat
          </button>
        </div>

        {/* Section Tabs */}
        <div className="flex px-3 gap-1 pb-2">
          {(["conversations", "folders", "tags", "settings"] as SidebarSection[]).map((s) => (
            <button
              key={s}
              onClick={() => setSection(s)}
              className={`flex-1 py-1.5 rounded-md text-[10px] font-medium uppercase tracking-wide transition-colors ${
                section === s ? "bg-ink-700 text-ink-100" : "text-ink-500 hover:text-ink-300 hover:bg-ink-800/50"
              }`}
            >
              {s === "conversations" ? "Chats" : s === "folders" ? "Folders" : s === "tags" ? "Tags" : "⚙"}
            </button>
          ))}
        </div>

        {/* ── CONVERSATIONS SECTION ── */}
        {section === "conversations" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search */}
            <div className="px-3 pb-2">
              <div className="flex items-center gap-2 px-3 py-2 bg-ink-800/60 border border-ink-700/60 rounded-lg">
                <SearchIcon />
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent text-xs text-ink-200 placeholder-ink-500 focus:outline-none"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="text-ink-500 hover:text-ink-300">
                    <XIcon />
                  </button>
                )}
              </div>
            </div>

            {/* Filter Pills */}
            <div className="px-3 pb-2 flex gap-1 flex-wrap">
              {filterButtons.map(({ filter, label, icon }) => (
                <button
                  key={filter}
                  onClick={() => {
                    setActiveFilter(filter);
                    setActiveFolderId(null);
                    setActiveTagId(null);
                  }}
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium transition-colors ${
                    activeFilter === filter && !activeFolderId && !activeTagId
                      ? "bg-blue-600 text-white"
                      : "bg-ink-800 text-ink-400 hover:bg-ink-700 hover:text-ink-200"
                  }`}
                >
                  {icon}
                  {label}
                  {filter === "deleted" && deletedCount > 0 && (
                    <span className="ml-0.5 bg-red-500 text-white text-[9px] rounded-full w-3.5 h-3.5 flex items-center justify-center">
                      {deletedCount > 9 ? "9+" : deletedCount}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Folder quick-filter */}
            {folders.length > 0 && (
              <div className="px-3 pb-2 flex gap-1 flex-wrap">
                {folders.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setActiveFolderId(activeFolderId === f.id ? null : f.id)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium transition-colors`}
                    style={
                      activeFolderId === f.id
                        ? { backgroundColor: f.color, color: "#fff" }
                        : { backgroundColor: f.color + "22", color: f.color }
                    }
                  >
                    {f.icon} {f.name}
                  </button>
                ))}
              </div>
            )}

            {/* Tag quick-filter */}
            {tags.length > 0 && (
              <div className="px-3 pb-2 flex gap-1 flex-wrap">
                {tags.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTagId(activeTagId === t.id ? null : t.id)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium transition-colors`}
                    style={
                      activeTagId === t.id
                        ? { backgroundColor: t.color, color: "#fff" }
                        : { backgroundColor: t.color + "22", color: t.color }
                    }
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            )}

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto px-3 space-y-0.5 scrollbar-thin">
              {activeFilter === "deleted" && deletedCount > 0 && (
                <div className="flex items-center justify-between px-2 py-1.5 mb-1">
                  <span className="text-[10px] text-ink-500">{deletedCount} item{deletedCount !== 1 ? "s" : ""} in trash</span>
                  <button
                    onClick={() => { if (confirm("Permanently delete all items in trash?")) emptyRecycleBin(); }}
                    className="text-[10px] text-red-400 hover:text-red-300 transition-colors"
                  >
                    Empty Trash
                  </button>
                </div>
              )}

              {filteredConversations.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-xs text-ink-500">
                    {searchQuery ? "No results found" : activeFilter === "deleted" ? "Trash is empty" : "No conversations yet"}
                  </p>
                  {activeFilter === "all" && !searchQuery && (
                    <p className="text-[10px] text-ink-600 mt-1">Start a new chat to begin</p>
                  )}
                </div>
              ) : (
                filteredConversations.map((conv) => (
                  <div key={conv.id}>
                    {activeFilter === "deleted" ? (
                      <div className="flex items-center gap-1 px-3 py-2 rounded-lg text-ink-400 hover:bg-ink-800/50">
                        <span className="flex-1 text-xs truncate">{conv.title}</span>
                        <button onClick={() => restoreConversation(conv.id)} className="p-1 hover:text-green-400 transition-colors" title="Restore">
                          <RestoreIcon />
                        </button>
                        <button onClick={() => { if (confirm("Permanently delete?")) permanentlyDeleteConversation(conv.id); }} className="p-1 hover:text-red-400 transition-colors" title="Delete forever">
                          <XIcon />
                        </button>
                      </div>
                    ) : (
                      <ConversationItem
                        conv={conv}
                        isActive={conv.id === activeConversationId}
                        folders={folders}
                        tags={tags}
                        onSelect={() => setActiveConversation(conv.id)}
                      />
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Import/Export */}
            <div className="px-3 py-2 border-t border-ink-800/60 flex gap-2">
              <button
                onClick={() => exportAll("json")}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-ink-800 hover:bg-ink-700 text-ink-400 hover:text-ink-200 text-[10px] font-medium transition-colors"
                title="Export all conversations"
              >
                <ExportIcon /> Export All
              </button>
              <button
                onClick={() => importFileRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-ink-800 hover:bg-ink-700 text-ink-400 hover:text-ink-200 text-[10px] font-medium transition-colors"
                title="Import conversations"
              >
                <ImportIcon /> Import
              </button>
              <input ref={importFileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
            </div>
            {importError && (
              <p className="px-3 pb-2 text-[10px] text-yellow-400">{importError}</p>
            )}
          </div>
        )}

        {/* ── FOLDERS SECTION ── */}
        {section === "folders" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-3 py-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-ink-500 uppercase tracking-widest">Folders</span>
              <button onClick={() => setShowNewFolderInput(true)} className="p-1 rounded hover:bg-ink-800 text-ink-400 hover:text-ink-200 transition-colors">
                <PlusIcon />
              </button>
            </div>
            {showNewFolderInput && (
              <div className="px-3 pb-2 flex gap-1">
                <input
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateFolder();
                    if (e.key === "Escape") { setShowNewFolderInput(false); setNewFolderName(""); }
                  }}
                  placeholder="Folder name..."
                  className="flex-1 bg-ink-800 border border-ink-700 rounded px-2 py-1 text-xs text-ink-100 focus:outline-none focus:border-blue-500"
                />
                <button onClick={handleCreateFolder} className="p-1 text-green-400 hover:text-green-300"><CheckIcon /></button>
                <button onClick={() => { setShowNewFolderInput(false); setNewFolderName(""); }} className="p-1 text-ink-400 hover:text-ink-200"><XIcon /></button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto px-3 space-y-1 scrollbar-thin">
              {folders.length === 0 ? (
                <p className="py-6 text-center text-xs text-ink-500">No folders yet. Create one to organize your conversations.</p>
              ) : (
                folders.map((f) => {
                  const count = conversations.filter((c) => c.folderId === f.id && !c.isDeleted).length;
                  return (
                    <div key={f.id} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-ink-800 group cursor-pointer"
                      onClick={() => { setSection("conversations"); setActiveFolderId(f.id); }}>
                      <span style={{ color: f.color }} className="text-base">{f.icon}</span>
                      <span className="flex-1 text-xs text-ink-300 truncate">{f.name}</span>
                      <span className="text-[10px] text-ink-500">{count}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); if (confirm(`Delete folder "${f.name}"? Conversations will be moved to no folder.`)) deleteFolder(f.id); }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-ink-500 hover:text-red-400 transition-all"
                      >
                        <XIcon />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ── TAGS SECTION ── */}
        {section === "tags" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-3 py-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-ink-500 uppercase tracking-widest">Tags</span>
              <button onClick={() => setShowNewTagInput(true)} className="p-1 rounded hover:bg-ink-800 text-ink-400 hover:text-ink-200 transition-colors">
                <PlusIcon />
              </button>
            </div>
            {showNewTagInput && (
              <div className="px-3 pb-2 flex gap-1">
                <input
                  autoFocus
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateTag();
                    if (e.key === "Escape") { setShowNewTagInput(false); setNewTagName(""); }
                  }}
                  placeholder="Tag name..."
                  className="flex-1 bg-ink-800 border border-ink-700 rounded px-2 py-1 text-xs text-ink-100 focus:outline-none focus:border-blue-500"
                />
                <button onClick={handleCreateTag} className="p-1 text-green-400 hover:text-green-300"><CheckIcon /></button>
                <button onClick={() => { setShowNewTagInput(false); setNewTagName(""); }} className="p-1 text-ink-400 hover:text-ink-200"><XIcon /></button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto px-3 space-y-1 scrollbar-thin">
              {tags.length === 0 ? (
                <p className="py-6 text-center text-xs text-ink-500">No tags yet. Create tags to categorize your conversations.</p>
              ) : (
                tags.map((t) => {
                  const count = conversations.filter((c) => (c.tags ?? []).includes(t.id) && !c.isDeleted).length;
                  return (
                    <div key={t.id} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-ink-800 group cursor-pointer"
                      onClick={() => { setSection("conversations"); setActiveTagId(t.id); }}>
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                      <span className="flex-1 text-xs text-ink-300 truncate">{t.name}</span>
                      <span className="text-[10px] text-ink-500">{count}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); if (confirm(`Delete tag "${t.name}"?`)) deleteTag(t.id); }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-ink-500 hover:text-red-400 transition-all"
                      >
                        <XIcon />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ── SETTINGS SECTION ── */}
        {section === "settings" && (
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4 scrollbar-thin">
            <div>
              <p className="text-[10px] font-semibold text-ink-500 uppercase tracking-widest mb-2">Data Management</p>
              <div className="space-y-1.5">
                <button
                  onClick={() => exportAll("json")}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-ink-800 hover:bg-ink-700 text-ink-300 hover:text-white text-xs transition-colors"
                >
                  <ExportIcon /> Export All Conversations
                </button>
                <button
                  onClick={() => importFileRef.current?.click()}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-ink-800 hover:bg-ink-700 text-ink-300 hover:text-white text-xs transition-colors"
                >
                  <ImportIcon /> Import Conversations
                </button>
                <button
                  onClick={() => {
                    if (confirm("Empty recycle bin? This cannot be undone.")) emptyRecycleBin();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-ink-800 hover:bg-red-900/40 text-ink-400 hover:text-red-300 text-xs transition-colors"
                >
                  <TrashIcon /> Empty Recycle Bin {deletedCount > 0 ? `(${deletedCount})` : ""}
                </button>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-ink-500 uppercase tracking-widest mb-2">Library Stats</p>
              <div className="bg-ink-800/60 rounded-lg p-3 space-y-1.5">
                {[
                  ["Total conversations", conversations.filter((c) => !c.isDeleted).length],
                  ["Folders", folders.length],
                  ["Tags", tags.length],
                  ["Archived", conversations.filter((c) => c.isArchived && !c.isDeleted).length],
                  ["In trash", deletedCount],
                ].map(([label, value]) => (
                  <div key={label as string} className="flex justify-between text-xs">
                    <span className="text-ink-400">{label}</span>
                    <span className="text-ink-200 font-mono">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;

"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronRight, FolderInput, FolderPlus, Mail, MoreVertical, PanelLeft, Pencil, Pin, Trash2 } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onNewChat?: () => void;
  onChatSelect?: (chatId: string) => void;
  onDeleteChat?: (chatId: string) => void;
  currentChatId?: string;
  chats?: Array<{
    id: string;
    title: string;
    preview: string;
    timestamp: string;
    isActive: boolean;
    isStarred?: boolean;
    unread?: boolean;
  }>;
}

export default function ArdiSidebar({ 
  isOpen, 
  onClose, 
  isCollapsed: sidebarHidden, 
  onToggleCollapse,
  onNewChat,
  onChatSelect,
  onDeleteChat,
  currentChatId,
  chats
}: SidebarProps) {
  // Claude hides the whole panel. Keep the full sidebar layout while it slides away.
  const isCollapsed = false;
  const [activeChat, setActiveChat] = useState<string>('1');
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchEndX, setTouchEndX] = useState(0);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState<Array<{
    id: string;
    title: string;
    preview: string;
    timestamp: string;
    isActive: boolean;
    isStarred?: boolean;
    unread?: boolean;
  }>>([]);
  const [hoveredChatId, setHoveredChatId] = useState<string | null>(null);
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);
  const [menuChatId, setMenuChatId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [submenu, setSubmenu] = useState<'project' | 'group' | null>(null);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);

  useEffect(() => {
    const handleResize = () => {
      if (typeof onClose === 'function' && window.innerWidth < 1024 && isOpen) {
        onClose();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, onClose]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isProfileDropdownOpen && !(event.target as Element).closest('.profile-dropdown-container')) {
        setIsProfileDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProfileDropdownOpen]);

  // Update local chatHistory when chats prop changes
  useEffect(() => {
    if (chats) {
      setChatHistory(chats);
    }
  }, [chats]);

  // Close delete dialog when clicking outside or pressing Escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && chatToDelete !== null) {
        setChatToDelete(null);
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (chatToDelete !== null && !(event.target as Element).closest('.delete-dialog')) {
        setChatToDelete(null);
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [chatToDelete]);

  const handleClose = () => {
    if (typeof onClose === 'function') {
      onClose();
    }
  };

  const deleteChat = (chatId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent chat selection when clicking delete
    setChatToDelete(chatId);
  };

  const confirmDeleteChat = () => {
    if (chatToDelete === null) return;
    
    // Call the parent's delete function if provided
    if (onDeleteChat) {
      onDeleteChat(chatToDelete);
    }
    
    // If the deleted chat was active, set the first remaining chat as active
    if (activeChat === chatToDelete) {
      const remainingChats = chatHistory.filter(chat => chat.id !== chatToDelete);
      if (remainingChats.length > 0) {
        setActiveChat(remainingChats[0].id);
      }
    }
    
    setChatToDelete(null);
  };

  const cancelDeleteChat = () => {
    setChatToDelete(null);
  };

  const closeChatMenu = () => {
    setMenuChatId(null);
    setSubmenu(null);
  };

  const openChatMenu = (event: React.MouseEvent<HTMLButtonElement>, chatId: string) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 232;
    const menuHeight = 292;
    const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8));
    const top = rect.bottom + 6 + menuHeight > window.innerHeight
      ? Math.max(8, rect.top - menuHeight - 6)
      : rect.bottom + 6;
    setMenuPosition({ top, left });
    setMenuChatId(chatId);
    setSubmenu(null);
  };

  const renameChat = (chatId: string, title: string) => {
    const nextTitle = title.trim();
    setRenamingChatId(null);
    if (!nextTitle) return;
    window.dispatchEvent(new CustomEvent('chat-rename', { detail: { chatId, title: nextTitle } }));
  };

  useEffect(() => {
    if (!menuChatId) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.chat-options-menu') && !target.closest('.chat-options-button')) {
        closeChatMenu();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (event.key === 'Escape') {
        closeChatMenu();
        return;
      }
      if (key === 'p') {
        window.dispatchEvent(new CustomEvent('chat-pin-toggle', { detail: { chatId: menuChatId } }));
        closeChatMenu();
      } else if (key === 'u') {
        window.dispatchEvent(new CustomEvent('chat-unread-toggle', { detail: { chatId: menuChatId } }));
        closeChatMenu();
      } else if (key === 'r') {
        setRenamingChatId(menuChatId);
        closeChatMenu();
      } else if (key === 'd') {
        setChatToDelete(menuChatId);
        closeChatMenu();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuChatId]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEndX(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStartX || !touchEndX) return;
    
    const distance = touchStartX - touchEndX;
    const isLeftSwipe = distance > 50;
    
    if (isLeftSwipe && isOpen) {
      handleClose();
    }
  };



  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-white/5 backdrop-blur-xs z-40 lg:hidden transition-all duration-300" 
          onClick={handleClose}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-700 flex flex-col transform transition-all duration-200 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } ${sidebarHidden
        ? 'w-64 sm:w-80 lg:w-0 lg:min-w-0 lg:overflow-hidden lg:border-r-0 lg:static lg:translate-x-0 lg:pointer-events-none'
        : 'w-64 sm:w-80 lg:static lg:translate-x-0'
      }`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}>
        {/* Header */}
        <div className={`${isCollapsed ? 'p-2' : 'p-3 sm:p-4'} flex-shrink-0`}>
          <div className="flex items-center justify-between">
            {isCollapsed ? (
              // Collapsed header - only logo and collapse toggle
              <div className="flex flex-col items-center space-y-2 w-full">
                <div className="relative">
                  <Image
                    src="/img/LogoArdi.svg"
                    alt="Ardi Logo"
                    width={24}
                    height={24}
                    className="w-5 h-5 sm:w-6 sm:h-6"
                  />
                  <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full border border-white"></div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">MENU</div>
                <div className="flex flex-col items-center space-y-2">
                  <button 
                    onClick={onToggleCollapse}
                    className="p-2 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100 transition-colors"
                    aria-label="Open sidebar"
                    title="Open sidebar"
                  >
                    <PanelLeft className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            ) : (
              // Expanded header
              <>
                <div className="flex items-center space-x-2">
                                  <div className="relative">
                  <Image
                    src="/img/LogoArdi.svg"
                    alt="Ardi Logo"
                    width={28}
                    height={28}
                    className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7"
                  />
                  <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 sm:w-2 sm:h-2 md:w-2.5 md:h-2.5 bg-green-500 rounded-full border border-white"></div>
                </div>
                  <h1 className="text-base sm:text-lg font-normal text-gray-900 dark:text-gray-100">
                    Ardi
                  </h1>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={onToggleCollapse}
                    className="p-2 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100 transition-colors"
                    aria-label="Close sidebar"
                    title="Close sidebar"
                  >
                    <PanelLeft className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                  
                  <button 
                    onClick={handleClose} 
                    className="lg:hidden p-2 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100 transition-colors"
                    aria-label="Close sidebar"
                    title="Close sidebar"
                  >
                    <PanelLeft className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* New Chat Button */}
        <div className={`${isCollapsed ? 'p-2' : 'p-3 sm:p-4'} flex-shrink-0`}>
          {isCollapsed ? (
            <button 
              onClick={() => {
                if (onNewChat) {
                  onNewChat();
                }
                handleClose();
              }}
              className="w-full p-2.5 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600 border border-gray-200 dark:border-gray-700 transition-all duration-200 active:scale-[0.98] touch-manipulation shadow-sm hover:shadow-md flex items-center justify-center"
              title="New Chat"
            >
              <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          ) : (
            <button 
              onClick={() => {
                if (onNewChat) {
                  onNewChat();
                }
                handleClose();
              }}
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600 border border-gray-200 dark:border-gray-700 rounded-lg transition-all duration-200 active:scale-[0.98] touch-manipulation shadow-sm hover:shadow-md"
            >
              <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-gray-700 dark:text-gray-300 font-medium">New Chat</span>
            </button>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className={`${isCollapsed ? 'p-2' : 'p-3 sm:p-4'} flex-shrink-0`}>
          {isCollapsed ? (
            // Collapsed view - only icons
            <div className="space-y-1">
              <button 
                onClick={() => {
                  // Handle starred chats
                  handleClose();
                }}
                className="w-full p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 active:bg-gray-100 dark:active:bg-gray-700 transition-all duration-200 active:scale-[0.98] touch-manipulation flex items-center justify-center"
                title="Starred Chats"
              >
                <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </button>
              
              <button 
                onClick={() => {
                  // Handle search chats
                  handleClose();
                }}
                className="w-full p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 active:bg-gray-100 dark:active:bg-gray-700 transition-all duration-200 active:scale-[0.98] touch-manipulation flex items-center justify-center"
                title="Search Chats"
              >
                <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          ) : (
            // Expanded view - Buttons with labels
            <div className="space-y-1">
              <button 
                onClick={() => {
                  // Handle starred chats
                  handleClose();
                }}
                className="w-full flex items-center space-x-2.5 py-2 px-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 active:bg-gray-100 dark:active:bg-gray-700 rounded-lg transition-all duration-200 active:scale-[0.98] touch-manipulation"
              >
                <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                <span className="text-gray-600 dark:text-gray-300 font-medium text-sm">Starred Chats</span>
              </button>
              
              <button 
                onClick={() => {
                  // Handle search chats
                  handleClose();
                }}
                className="w-full flex items-center space-x-2.5 py-2 px-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 active:bg-gray-100 dark:active:bg-gray-700 rounded-lg transition-all duration-200 active:scale-[0.98] touch-manipulation"
              >
                <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span className="text-gray-600 dark:text-gray-300 font-medium text-sm">Search Chats</span>
              </button>
            </div>
          )}
        </div>

        {/* Chat History - Takes remaining space */}
        <div className={`flex-1 overflow-y-auto ${isCollapsed ? 'px-2' : 'px-3 sm:px-4'}`}>
          <div className={`${isCollapsed ? 'space-y-1' : 'space-y-1'} pb-3`}>
            {!isCollapsed && chatHistory.length > 0 && (
              <h2 className="px-2 mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                Recent Chats
              </h2>
            )}
            
            {[...chatHistory]
              .sort((a, b) => Number(Boolean(b.isStarred)) - Number(Boolean(a.isStarred)))
              .map((chat) => {
              const isActive = (currentChatId !== undefined ? currentChatId : activeChat) === chat.id;
              const menuOpen = menuChatId === chat.id;
              const showActions = hoveredChatId === chat.id || menuOpen;
              return (
              <div
                key={chat.id}
                onMouseEnter={() => setHoveredChatId(chat.id)}
                onMouseLeave={() => setHoveredChatId(null)}
                className={`group relative flex items-center rounded-md cursor-pointer transition-colors touch-manipulation ${
                  isCollapsed ? 'p-2 justify-center' : 'px-2 py-1.5'
                } ${
                  isActive || menuOpen
                    ? 'bg-gray-100 dark:bg-white/10'
                    : 'hover:bg-gray-100 dark:hover:bg-white/5'
                }`}
                title={chat.title}
              >
                <div
                  onClick={() => {
                    if (renamingChatId === chat.id) return;
                    if (onChatSelect) {
                      onChatSelect(chat.id);
                    }
                    setActiveChat(chat.id);
                    window.dispatchEvent(new CustomEvent('chat-mark-read', { detail: { chatId: chat.id } }));
                    handleClose();
                  }}
                  className="min-w-0 flex-1"
                >
                  {isCollapsed ? (
                    <div className="flex items-center justify-center">
                      <div className={`w-2 h-2 rounded-full ${
                        isActive
                          ? 'bg-gray-700 dark:bg-gray-200'
                          : 'bg-gray-400 dark:bg-gray-500'
                      }`}></div>
                    </div>
                  ) : renamingChatId === chat.id ? (
                    <input
                      autoFocus
                      defaultValue={chat.title}
                      aria-label="Rename chat"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') renameChat(chat.id, event.currentTarget.value);
                        if (event.key === 'Escape') setRenamingChatId(null);
                      }}
                      onBlur={(event) => renameChat(chat.id, event.currentTarget.value)}
                      className="w-full bg-transparent text-sm text-gray-800 dark:text-gray-200 outline-none"
                    />
                  ) : (
                    <h3 className="truncate text-sm font-normal text-gray-800 dark:text-gray-200">
                      {chat.title}
                    </h3>
                  )}
                </div>

                {!isCollapsed && showActions && (
                  <button
                    type="button"
                    onClick={(event) => openChatMenu(event, chat.id)}
                    className="chat-options-button ml-1 shrink-0 rounded-md p-1 text-gray-500 hover:bg-black/5 hover:text-gray-800 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-gray-100"
                    aria-label="Chat options"
                    title="Chat options"
                  >
                    <MoreVertical className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                )}
                {!isCollapsed && !showActions && chat.unread && (
                  <span className="ml-2 h-2 w-2 shrink-0 rounded-full bg-sky-500" />
                )}
              </div>
              );
            })}
          </div>
        </div>

        {/* Footer - Profile Section */}
        <div className={`${isCollapsed ? 'p-2' : 'p-3 sm:p-4'} relative profile-dropdown-container flex-shrink-0 border-t border-gray-200 dark:border-gray-700`}>
          {isCollapsed ? (
            // Collapsed profile section
            <button
              onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
              className="w-full flex items-center justify-center p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 active:bg-gray-100 dark:active:bg-gray-700 transition-all duration-200 active:scale-[0.98] touch-manipulation"
              title="Profile Menu"
            >
              <div className="w-6 h-6 bg-gray-800 dark:bg-gray-700 rounded-lg flex items-center justify-center relative">
                <span className="text-white text-xs font-medium">JD</span>
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-white"></div>
              </div>
            </button>
          ) : (
            // Expanded profile section
            <button
              onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
              className="w-full flex items-center space-x-2.5 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 active:bg-gray-100 dark:active:bg-gray-700 transition-all duration-200 active:scale-[0.98] touch-manipulation"
            >
              <div className="w-6 h-6 bg-gray-800 dark:bg-gray-700 rounded-lg flex items-center justify-center relative">
                <span className="text-white text-xs font-medium">JD</span>
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-white"></div>
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="text-gray-900 dark:text-gray-100 font-medium text-sm">John Doe</div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-normal truncate">john@company.com</p>
              </div>
              <svg className="w-3 h-3 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
          
          {/* Profile Dropdown */}
          {isProfileDropdownOpen && (
            <div className={`absolute ${isCollapsed ? 'bottom-full left-0 right-0 mb-2' : 'bottom-full left-0 right-0 mb-2'} bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-50 ${isCollapsed ? 'min-w-[200px] -left-[92px]' : 'min-w-[200px]'}`}>
              <Link href="/profile" passHref>
                <button 
                  onClick={() => {
                    setIsProfileDropdownOpen(false);
                    if (typeof onClose === 'function') {
                      onClose();
                    }
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center space-x-3 transition-colors duration-200"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>Profile</span>
                </button>
              </Link>
              <Link href="/settings" passHref>
                <button className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center space-x-3 transition-colors duration-200">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Settings</span>
                </button>
              </Link>
              <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>
              <button className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center space-x-3 transition-colors duration-200">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>

        {/* Mobile indicator */}
        {!isCollapsed && (
          <div className="lg:hidden flex justify-center pt-1">
            <div className="w-6 h-0.5 bg-gray-300 rounded-full"></div>
          </div>
        )}
      </div>

      {menuChatId && chatHistory.some((chat) => chat.id === menuChatId) && (
        <div
          className="chat-options-menu fixed z-[80] w-[232px] rounded-xl border border-white/10 bg-[#2a2a28] p-1.5 text-sm text-[#f2f1ec] shadow-2xl"
          style={{ top: menuPosition.top, left: menuPosition.left }}
        >
          {(() => {
            const menuChat = chatHistory.find((chat) => chat.id === menuChatId);
            if (!menuChat) return null;
            const itemClass = "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-white/10";
            return (
              <>
                <button
                  type="button"
                  className={itemClass}
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('chat-pin-toggle', { detail: { chatId: menuChat.id } }));
                    closeChatMenu();
                  }}
                >
                  <Pin className="h-4 w-4" strokeWidth={1.75} />
                  <span className="flex-1">{menuChat.isStarred ? 'Unpin' : 'Pin'}</span>
                  <span className="text-xs text-[#8a8984]">P</span>
                </button>
                <button
                  type="button"
                  className={itemClass}
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('chat-unread-toggle', { detail: { chatId: menuChat.id } }));
                    closeChatMenu();
                  }}
                >
                  <Mail className="h-4 w-4" strokeWidth={1.75} />
                  <span className="flex-1">{menuChat.unread ? 'Mark as read' : 'Mark as unread'}</span>
                  <span className="text-xs text-[#8a8984]">U</span>
                </button>
                <button
                  type="button"
                  className={itemClass}
                  onClick={() => {
                    setRenamingChatId(menuChat.id);
                    closeChatMenu();
                  }}
                >
                  <Pencil className="h-4 w-4" strokeWidth={1.75} />
                  <span className="flex-1">Rename</span>
                  <span className="text-xs text-[#8a8984]">R</span>
                </button>
                <div
                  className="relative"
                  onMouseEnter={() => setSubmenu('project')}
                  onMouseLeave={() => setSubmenu((current) => current === 'project' ? null : current)}
                >
                  <button type="button" className={itemClass}>
                    <FolderPlus className="h-4 w-4" strokeWidth={1.75} />
                    <span className="flex-1">Add to project</span>
                    <ChevronRight className="h-4 w-4 text-[#8a8984]" />
                  </button>
                  {submenu === 'project' && (
                    <div className="absolute left-full top-0 z-[81] ml-1 w-44 rounded-xl border border-white/10 bg-[#2a2a28] p-2 text-[#8a8984] shadow-2xl">
                      No projects yet
                    </div>
                  )}
                </div>
                <div
                  className="relative"
                  onMouseEnter={() => setSubmenu('group')}
                  onMouseLeave={() => setSubmenu((current) => current === 'group' ? null : current)}
                >
                  <button type="button" className={itemClass}>
                    <FolderInput className="h-4 w-4" strokeWidth={1.75} />
                    <span className="flex-1">Move to group</span>
                    <ChevronRight className="h-4 w-4 text-[#8a8984]" />
                  </button>
                  {submenu === 'group' && (
                    <div className="absolute left-full top-0 z-[81] ml-1 w-44 rounded-xl border border-white/10 bg-[#2a2a28] p-2 text-[#8a8984] shadow-2xl">
                      No groups yet
                    </div>
                  )}
                </div>
                <div className="my-1 border-t border-white/10" />
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[#e07a6a] hover:bg-white/10"
                  onClick={(event) => {
                    deleteChat(menuChat.id, event);
                    closeChatMenu();
                  }}
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                  <span className="flex-1">Delete</span>
                  <span className="text-xs text-[#e07a6a]/70">D</span>
                </button>
              </>
            );
          })()}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {chatToDelete !== null && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-xs z-[9999] flex items-center justify-center p-4">
          <div className="delete-dialog bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 max-w-sm w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Delete Chat</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">This action cannot be undone.</p>
              </div>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={cancelDeleteChat}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteChat}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 rounded-lg transition-colors duration-200"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

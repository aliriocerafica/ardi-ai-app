"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { IoMdAttach, IoMdSend } from 'react-icons/io';
import { IoStop } from 'react-icons/io5';
import { HiDotsVertical } from 'react-icons/hi';
import { FiStar, FiShare2, FiTrash2 } from 'react-icons/fi';
import ChatMessages from './ChatMessages';
import ThemeToggle from './ThemeToggle';
import { emptyStateHeading } from '../../lib/chatGreeting';
// Content filtering and knowledge lookup now handled by API routes

interface Message {
  id: number;
  sender: 'user' | 'ardi';
  content: string;
  timestamp: string;
}

interface ChatData {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  isStarred: boolean;
  unread?: boolean;
}

interface ChatProps {
  onNewChat?: () => void;
  onChatSelect?: (chatId: string) => void;
  currentChatId?: string;
}

const CHAT_COMMANDS = [
  { name: 'help', description: 'Show the command list' },
  { name: 'stop', description: 'Stop the reply being written' },
  { name: 'new', description: 'Start a new chat' },
  { name: 'questions', description: 'Show suggested questions' },
  { name: 'retry', description: 'Ask the last question again' }
];

const HELP_REPLY = [
  '**Commands**',
  '',
  '- **/help** — show this list',
  '- **/stop** — stop the reply being written',
  '- **/new** — start a new chat',
  '- **/questions** — show suggested questions',
  '- **/retry** — ask the last question again',
  '',
  'Type `/` in the message box to open the list.'
].join('\n');

interface ActiveGeneration {
  id: number;
  aborted: boolean;
  chatId: string;
  messageId: number | null;
  shown: string;
  timer: ReturnType<typeof setTimeout> | null;
  controller: AbortController;
}

function nextStreamIndex(text: string, index: number): number {
  if (index >= text.length) return text.length;
  const step = 28;
  const end = Math.min(text.length, index + step);
  if (end >= text.length) return text.length;
  const newline = text.indexOf('\n', index);
  if (newline !== -1 && newline < end) return newline + 1;
  const space = text.lastIndexOf(' ', end);
  if (space > index + 8) return space + 1;
  return end;
}

export default function Chat({ onNewChat, onChatSelect, currentChatId }: ChatProps) {
  const [chats, setChats] = useState<ChatData[]>([]);
  const [internalCurrentChatId, setInternalCurrentChatId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingMessageId, setTypingMessageId] = useState<number | null>(null);
  const [displayedText, setDisplayedText] = useState<{ [key: number]: string }>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isStarred, setIsStarred] = useState(false);
  const [isResponding, setIsResponding] = useState(false);
  const [canSendMessage, setCanSendMessage] = useState(true);
  const [showQuestions, setShowQuestions] = useState(false);
  const [commandIndex, setCommandIndex] = useState(0);
  const [heroHeading, setHeroHeading] = useState('How can I help you today?');
  const messagesRef = useRef<Message[]>([]);
  const currentChatIdRef = useRef('');
  const generationRef = useRef<ActiveGeneration | null>(null);
  const generationSeq = useRef(0);
  const stopGenerationRef = useRef<() => Message[]>(() => messagesRef.current);
  messagesRef.current = messages;
  currentChatIdRef.current = internalCurrentChatId;

  useEffect(() => {
    setHeroHeading(emptyStateHeading());
  }, []);

  // Predefined questions that users can ask
  const suggestedQuestions = [
    // Training and Employment Questions
    "How long is the training period for CMA?",
    "What is the training period for Case Manager Assistants?",
    "How long does training last for different roles?",
    "What is the training duration for Medical Records?",
    "How long is training for Speak Easy Account?",
    "What is the BDJ account training period?",
    "What training do Case Manager Assistants receive?",
    "How long does it take to train new employees?",
    "How long is HR training?",
    "What is the Human Resources training period?",
    "How long does HR training last?",
    "What is the training duration for HR roles?",
    "How long is Case Management training?",
    "What is the Case Management training period?",
    "How long does Case Management training last?",
    
    // Role and Position Questions
    "What is a case manager?",
    "What is a Case Manager Assistant (CMA)?",
    "What is CMA?",
    "What is a CMA?",
    "What does a CMA do?",
    "What does Case Manager Assistant do?",
    "CMA job responsibilities",
    "Case Manager Assistant responsibilities",
    "CMA role",
    "Case Manager Assistant role",
    "What is a medical records clerk?",
    "What are the responsibilities of a Case Manager Assistant?",
    "What roles are available at Ardent?",
    "What positions does Ardent hire for?",
    "What is the difference between CM and CMA?",
    "What is HR?",
    "What does Human Resources do?",
    "What are HR responsibilities?",
    "What is an HR role at Ardent?",
    
    // Company Information Questions
    "How many accounts does Ardent have?",
    "What accounts does Ardent manage?",
    "Who are Ardent's clients?",
    "What is Ardent Paralegal Business Solutions?",
    "Tell me about Ardent company",
    "What services does Ardent provide?",
    "How big is Ardent?",
    "Where is Ardent located?",
    
    // Legal Process Questions
    "How do I file a personal injury claim?",
    "What documents do I need for my case?",
    "How long does a personal injury case take?",
    "What is the statute of limitations for personal injury?",
    "How is pain and suffering calculated?",
    "What should I do immediately after an accident?",
    "When should I contact a personal injury lawyer?",
    "What is the difference between a settlement and a trial?",
    "How do I deal with insurance companies?",
    "What medical records are important for my case?",
    "Can I still file a claim if I was partially at fault?",
    "What is workers' compensation?",
    "How do I prepare for a deposition?",
    "What is mediation in a personal injury case?",
    "How do I calculate my medical expenses?",
    "What is the role of expert witnesses?",
    "How do I document my injuries properly?",
    "What should I expect during the legal process?",
    
    // ARDI and Technology Questions
    "What is ARDI?",
    "What does ARDI stand for?",
    "How can ARDI help me?",
    "What can you assist with?",
    "What version of ARDI are you?",
    "How does ARDI work?",
    "What features does ARDI have?",
    
    // Case Management Questions
    "How does case management work?",
    "What are case management features?",
    "How to organize legal cases?",
    "What is the intake process?",
    "How do you handle client intake?",
    "What is the case workflow?",
    "How do you track deadlines?",
    "What is document management?",
    
    // Account Specific Questions
    "What is Speak Easy Account?",
    "What is BDJ Account?",
    "Tell me about different client accounts",
    "What type of cases does each account handle?",
    "How are accounts assigned?"
  ];

  const createNewChat = useCallback(() => {
    stopGenerationRef.current();
    currentChatIdRef.current = '';
    setInternalCurrentChatId('');
    setMessages([]);
    setIsStarred(false);
    setInputMessage('');
    setDisplayedText({});
    setIsTyping(false);
    setIsResponding(false);
    setCanSendMessage(true);
    window.dispatchEvent(new CustomEvent('new-chat-created', { detail: { chatId: '' } }));
  }, []);

  // Load chats from localStorage on component mount
  useEffect(() => {
    const savedChats = localStorage.getItem('ardi-chats');
    if (savedChats) {
      const parsedChats = (JSON.parse(savedChats) as ChatData[]).filter(
        (chat) => Array.isArray(chat.messages) && chat.messages.length > 0
      );
      setChats(parsedChats);
      
      if (parsedChats.length > 0) {
        const mostRecentChat = parsedChats[parsedChats.length - 1];
        setInternalCurrentChatId(mostRecentChat.id);
        setMessages(mostRecentChat.messages);
        setIsStarred(mostRecentChat.isStarred);
      } else {
        setInternalCurrentChatId('');
        setMessages([]);
      }
    } else {
      setInternalCurrentChatId('');
      setMessages([]);
    }
  }, [createNewChat]);

  // Save chats to localStorage whenever chats change
  useEffect(() => {
    if (chats.length > 0) {
      localStorage.setItem('ardi-chats', JSON.stringify(chats));
      // Dispatch event to notify sidebar of chat updates
      window.dispatchEvent(new CustomEvent('chat-updated'));
    }
  }, [chats]);

  // Update current chat messages when internalCurrentChatId changes
  useEffect(() => {
    const currentChat = chats.find(chat => chat.id === internalCurrentChatId);
    if (currentChat) {
      if (generationRef.current?.chatId === internalCurrentChatId) return;
      setMessages(currentChat.messages);
      setIsStarred(currentChat.isStarred);
    }
  }, [internalCurrentChatId, chats]);

  // Handle currentChatId prop changes from parent.
  // An empty id is a new draft and must not reload the previous chat.
  useEffect(() => {
    if (!currentChatId) {
      if (internalCurrentChatId) {
        currentChatIdRef.current = '';
        setInternalCurrentChatId('');
        setMessages([]);
        setIsStarred(false);
        setInputMessage('');
        setDisplayedText({});
      }
      return;
    }

    if (currentChatId === internalCurrentChatId) return;

    const targetChat = chats.find(chat => chat.id === currentChatId);
    if (targetChat) {
      currentChatIdRef.current = currentChatId;
      stopGenerationRef.current();
      setInternalCurrentChatId(currentChatId);
      setMessages(targetChat.messages);
      setIsStarred(targetChat.isStarred);
      setIsTyping(false);
      setIsResponding(false);
      setCanSendMessage(true);
    }
  }, [currentChatId, chats, internalCurrentChatId]);

  // Handle new chat creation from sidebar
  useEffect(() => {
    const handleNewChatRequest = () => {
      createNewChat();
    };
    
    window.addEventListener('new-chat-requested', handleNewChatRequest);
    return () => {
      window.removeEventListener('new-chat-requested', handleNewChatRequest);
    };
  }, [createNewChat]);



  const switchToChat = (chatId: string) => {
    setInternalCurrentChatId(chatId);
    stopGenerationRef.current();
    setIsTyping(false);
    setIsResponding(false);
    setCanSendMessage(true);
  };

  const updateCurrentChat = (updatedMessages: Message[], chatId = internalCurrentChatId) => {
    setChats(prev => prev.map(chat => 
      chat.id === chatId 
        ? { ...chat, messages: updatedMessages }
        : chat
    ));
  };

  const updateChatTitle = (chatId: string, title: string) => {
    setChats(prev => prev.map(chat => 
      chat.id === chatId 
        ? { ...chat, title }
        : chat
    ));
  };

  const toggleChatStar = (chatId: string) => {
    setChats(prev => prev.map(chat => 
      chat.id === chatId 
        ? { ...chat, isStarred: !chat.isStarred }
        : chat
    ));
  };

  const deleteChat = useCallback((chatId: string) => {
    setChats(prev => prev.filter(chat => chat.id !== chatId));
    
    // If we're deleting the current chat, switch to the most recent one
    if (chatId === internalCurrentChatId) {
      const remainingChats = chats.filter(chat => chat.id !== chatId);
      if (remainingChats.length > 0) {
        const mostRecentChat = remainingChats[remainingChats.length - 1];
        setInternalCurrentChatId(mostRecentChat.id);
        setMessages(mostRecentChat.messages);
        setIsStarred(mostRecentChat.isStarred);
      } else {
        setInternalCurrentChatId('');
        setMessages([]);
        setInputMessage('');
        setIsStarred(false);
      }
    }
  }, [chats, internalCurrentChatId]);

  useEffect(() => {
    const handlePin = (event: Event) => {
      const chatId = (event as CustomEvent<{ chatId?: string }>).detail?.chatId;
      if (chatId) toggleChatStar(chatId);
    };
    const handleRename = (event: Event) => {
      const detail = (event as CustomEvent<{ chatId?: string; title?: string }>).detail;
      if (detail?.chatId && detail.title) updateChatTitle(detail.chatId, detail.title);
    };
    const handleUnread = (event: Event) => {
      const chatId = (event as CustomEvent<{ chatId?: string }>).detail?.chatId;
      if (!chatId) return;
      setChats(prev => prev.map(chat => chat.id === chatId ? { ...chat, unread: !chat.unread } : chat));
    };
    const handleRead = (event: Event) => {
      const chatId = (event as CustomEvent<{ chatId?: string }>).detail?.chatId;
      if (!chatId) return;
      setChats(prev => prev.map(chat => chat.id === chatId ? { ...chat, unread: false } : chat));
    };

    window.addEventListener('chat-pin-toggle', handlePin);
    window.addEventListener('chat-rename', handleRename);
    window.addEventListener('chat-unread-toggle', handleUnread);
    window.addEventListener('chat-mark-read', handleRead);
    return () => {
      window.removeEventListener('chat-pin-toggle', handlePin);
      window.removeEventListener('chat-rename', handleRename);
      window.removeEventListener('chat-unread-toggle', handleUnread);
      window.removeEventListener('chat-mark-read', handleRead);
    };
  }, []);

  // Handle chat deletion from sidebar
  useEffect(() => {
    const handleChatDeleted = (event: CustomEvent) => {
      const { chatId } = event.detail;
      deleteChat(chatId);
    };
    
    window.addEventListener('chat-deleted', handleChatDeleted as EventListener);
    return () => {
      window.removeEventListener('chat-deleted', handleChatDeleted as EventListener);
    };
  }, [deleteChat]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (isDropdownOpen && !target.closest('.dropdown-container')) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const handleStarChat = () => {
    if (internalCurrentChatId) {
      toggleChatStar(internalCurrentChatId);
    }
    setIsDropdownOpen(false);
  };

  const handleShareChat = () => {
    // TODO: Implement share chat functionality
    console.log('Share this chat');
    setIsDropdownOpen(false);
  };

  const handleDeleteChat = () => {
    if (internalCurrentChatId) {
      deleteChat(internalCurrentChatId);
    }
    setIsDropdownOpen(false);
  };

  const handleRetryMessage = (messageId: number) => {
    // Find the ARDI message to retry
    const ardiMessageIndex = messages.findIndex(msg => msg.id === messageId && msg.sender === 'ardi');
    if (ardiMessageIndex === -1) return;

    // Find the user message that prompted this ARDI response
    const userMessageIndex = ardiMessageIndex - 1;
    if (userMessageIndex < 0 || messages[userMessageIndex].sender !== 'user') return;

    const userMessage = messages[userMessageIndex];
    
    // Remove the current ARDI response
    const updatedMessages = messages.filter((_, index) => index !== ardiMessageIndex);
    setMessages(updatedMessages);
    updateCurrentChat(updatedMessages);
    
    // Clear any displayed text for this message
    setDisplayedText(prev => {
      const newDisplayedText = { ...prev };
      delete newDisplayedText[messageId];
      return newDisplayedText;
    });

    messagesRef.current = updatedMessages;
    queueAssistantReply(internalCurrentChatId, updatedMessages, userMessage.content);
  };

  const handleEditMessage = (messageId: number, newContent: string) => {
    if (newContent.trim() === '') return;

    const updatedMessages = messages.map(msg => 
      msg.id === messageId 
        ? { ...msg, content: newContent.trim() }
        : msg
    );
    setMessages(updatedMessages);
    updateCurrentChat(updatedMessages);

    // If this was a user message and there's an ARDI response after it, regenerate the response
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex !== -1 && messages[messageIndex].sender === 'user') {
      const nextMessage = messages[messageIndex + 1];
      if (nextMessage && nextMessage.sender === 'ardi') {
        // Remove the current ARDI response
        const messagesWithoutArdi = updatedMessages.filter((_, index) => index !== messageIndex + 1);
        setMessages(messagesWithoutArdi);
        updateCurrentChat(messagesWithoutArdi);
        
        // Clear any displayed text for the ARDI message
        setDisplayedText(prev => {
          const newDisplayedText = { ...prev };
          delete newDisplayedText[nextMessage.id];
          return newDisplayedText;
        });

        messagesRef.current = messagesWithoutArdi;
        queueAssistantReply(internalCurrentChatId, messagesWithoutArdi, newContent.trim());
      }
    }
  };

  const getArdiResponse = async (
    userMessage: string,
    signal?: AbortSignal,
    history: { role: 'user' | 'assistant'; content: string }[] = []
  ) => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage, history }),
        signal,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        if (typeof data?.response === 'string' && data.response.trim()) {
          return data.response;
        }
        return "I couldn't complete that just now. Please try sending your message again.";
      }

      const data = await response.json();
      
      // Handle different response types
      if (data.shouldIgnore) {
        return null;
      }
      
      if (data.isInappropriate) {
        return data.response;
      }
      
      return data.response;
    } catch (error) {
      if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
        throw error;
      }
      console.error('Error getting Ardi response:', error);
      return getFallbackResponse(userMessage);
    }
  };

  const getFallbackResponse = (_userMessage: string) => {
    return "I couldn't complete that just now. Please try sending your message again.";
  };

  // Auto-scroll to show newest conversation at the top
  const scrollToNewest = useCallback(() => {
    if (messagesContainerRef.current && messages.length > 0) {
      const container = messagesContainerRef.current;
      const allMessageElements = container.querySelectorAll('.message-item');
      
      if (allMessageElements.length >= 2) {
        // Find the newest conversation (last user message and ARDI response)
        const newestConversationStart = allMessageElements.length - 2;
        const targetElement = allMessageElements[newestConversationStart];
        const lastElement = allMessageElements[allMessageElements.length - 1];
        
        if (targetElement && lastElement) {
          const lastElementHeight = (lastElement as HTMLElement).offsetHeight;
          const containerHeight = container.clientHeight;
          const scrollHeight = container.scrollHeight;
          
          // For very long responses, always scroll to bottom to show the latest content
          if (lastElementHeight > containerHeight * 0.6) {
            // Scroll to bottom for long responses
            container.scrollTo({
              top: scrollHeight,
              behavior: 'smooth'
            });
          } else {
            // For normal responses, scroll to show the conversation at the top
            const targetOffsetTop = (targetElement as HTMLElement).offsetTop;
            const idealScrollTop = Math.max(0, targetOffsetTop - 200);
            container.scrollTo({
              top: idealScrollTop,
              behavior: 'smooth'
            });
          }
        }
      } else if (allMessageElements.length === 1) {
        // For first message, scroll to top
        container.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      }
    }
  }, [messages.length]);
 

  // Auto-scroll when new messages are added
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.sender === 'user') {
        // New user message - scroll to show it at the top
        setTimeout(() => scrollToNewest(), 100);
      } else if (lastMessage.sender === 'ardi' && !typingMessageId) {
        // ARDI response completed - scroll to show complete conversation at top
        setTimeout(() => scrollToNewest(), 200);
      }
    }
  }, [messages, scrollToNewest, typingMessageId]);

  // Auto-scroll during typing to keep conversation visible
  useEffect(() => {
    if (typingMessageId !== null) {
      const scrollInterval = setInterval(() => {
        scrollToNewest();
      }, 100); // Very frequent scrolling for long responses
      
      return () => clearInterval(scrollInterval);
    }
  }, [typingMessageId, scrollToNewest]);

  const releaseGeneration = () => {
    setTypingMessageId(null);
    setIsTyping(false);
    setIsResponding(false);
    setCanSendMessage(true);
  };

  const stopGeneration = (): Message[] => {
    const gen = generationRef.current;
    if (!gen) return messagesRef.current;

    gen.aborted = true;
    gen.controller.abort();
    if (gen.timer) clearTimeout(gen.timer);
    generationRef.current = null;

    let nextMessages = messagesRef.current;
    if (gen.messageId != null) {
      const partial = gen.shown.trim();
      if (partial) {
        nextMessages = nextMessages.map(message =>
          message.id === gen.messageId ? { ...message, content: partial } : message
        );
        setDisplayedText(prev => ({ ...prev, [gen.messageId as number]: partial }));
      } else {
        nextMessages = nextMessages.filter(message => message.id !== gen.messageId);
        setDisplayedText(prev => {
          const next = { ...prev };
          delete next[gen.messageId as number];
          return next;
        });
      }
    }

    messagesRef.current = nextMessages;
    if (currentChatIdRef.current === gen.chatId) {
      setMessages(nextMessages);
    }
    updateCurrentChat(nextMessages, gen.chatId);
    releaseGeneration();
    return nextMessages;
  };
  stopGenerationRef.current = stopGeneration;

  const streamAssistantText = (messageId: number, fullText: string) => {
    const gen = generationRef.current;
    if (!gen || gen.aborted) return;

    gen.messageId = messageId;
    gen.shown = '';
    setTypingMessageId(messageId);
    setDisplayedText(prev => ({ ...prev, [messageId]: '' }));

    let index = 0;
    const step = () => {
      const current = generationRef.current;
      if (!current || current.aborted || current.messageId !== messageId) return;

      if (index >= fullText.length) {
        const finished = messagesRef.current.map(message =>
          message.id === messageId ? { ...message, content: fullText } : message
        );
        messagesRef.current = finished;
        if (currentChatIdRef.current === current.chatId) {
          setMessages(finished);
          setDisplayedText(prev => ({ ...prev, [messageId]: fullText }));
        }
        updateCurrentChat(finished, current.chatId);
        generationRef.current = null;
        releaseGeneration();
        return;
      }

      index = nextStreamIndex(fullText, index);
      const shown = fullText.slice(0, index);
      current.shown = shown;
      if (currentChatIdRef.current === current.chatId) {
        setDisplayedText(prev => ({ ...prev, [messageId]: shown }));
      }
      current.timer = setTimeout(step, 24);
    };

    gen.timer = setTimeout(step, 24);
  };

  useEffect(() => {
    return () => {
      const gen = generationRef.current;
      if (!gen) return;
      gen.aborted = true;
      gen.controller.abort();
      if (gen.timer) clearTimeout(gen.timer);
    };
  }, []);

  const queueAssistantReply = (chatId: string, baseMessages: Message[], prompt: string) => {
    const active = generationRef.current;
    if (active) {
      active.aborted = true;
      active.controller.abort();
      if (active.timer) clearTimeout(active.timer);
      generationRef.current = null;
    }

    const controller = new AbortController();
    const id = ++generationSeq.current;
    generationRef.current = {
      id,
      aborted: false,
      chatId,
      messageId: null,
      shown: '',
      timer: null,
      controller,
    };
    messagesRef.current = baseMessages;
    setIsTyping(true);
    setIsResponding(true);
    setCanSendMessage(false);

    void (async () => {
      try {
        const history = baseMessages
          .filter(message => message.content.trim())
          .map(message => ({
            role: message.sender === 'user' ? 'user' as const : 'assistant' as const,
            content: message.content.slice(0, 800)
          }));
        if (
          history.length > 0 &&
          history[history.length - 1].role === 'user' &&
          history[history.length - 1].content === prompt
        ) {
          history.pop();
        }
        const ardiResponseText = await getArdiResponse(prompt, controller.signal, history.slice(-6));
        const gen = generationRef.current;
        if (!gen || gen.id !== id || gen.aborted) return;

        if (typeof ardiResponseText !== 'string' || ardiResponseText.length === 0) {
          generationRef.current = null;
          releaseGeneration();
          return;
        }

        const ardiMessage: Message = {
          id: Date.now() + 1,
          sender: 'ardi',
          content: '',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        const finalMessages = [...messagesRef.current, ardiMessage];
        messagesRef.current = finalMessages;
        if (currentChatIdRef.current === chatId) {
          setMessages(finalMessages);
          setDisplayedText(prev => ({ ...prev, [ardiMessage.id]: '' }));
        }
        updateCurrentChat(finalMessages, chatId);
        streamAssistantText(ardiMessage.id, ardiResponseText);
      } catch (error) {
        const gen = generationRef.current;
        if (!gen || gen.id !== id || gen.aborted) return;
        console.error('Error getting Ardi response:', error);
        generationRef.current = null;
        releaseGeneration();
      }
    })();
  };

  const sendMessage = () => {
    const text = inputMessage.trim();
    if (text === '') return;

    const base = generationRef.current ? stopGeneration() : messagesRef.current;
    const userMessage: Message = {
      id: Date.now(),
      sender: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const title = text.length > 30 ? text.substring(0, 30) + '...' : text;
    const existing = chats.find(chat => chat.id === internalCurrentChatId);
    let chatId = internalCurrentChatId;
    let newMessages = [...base, userMessage];

    if (!existing) {
      chatId = Date.now().toString();
      newMessages = [userMessage];
      const created: ChatData = {
        id: chatId,
        title,
        messages: newMessages,
        createdAt: new Date(),
        isStarred: false
      };
      setChats(prev => [...prev, created]);
      currentChatIdRef.current = chatId;
      setInternalCurrentChatId(chatId);
      window.dispatchEvent(new CustomEvent('new-chat-created', { detail: { chatId } }));
    } else {
      if (base.length === 0) {
        updateChatTitle(chatId, title);
      }
      updateCurrentChat(newMessages, chatId);
    }

    messagesRef.current = newMessages;
    setMessages(newMessages);
    setInputMessage('');
    queueAssistantReply(chatId, newMessages, text);
  };

  // Initialize displayed text for existing Ardi messages
  useEffect(() => {
    messages.forEach(message => {
      if (message.sender === 'ardi') {
        setDisplayedText(prev => {
          if (prev[message.id] === undefined) {
            return {
              ...prev,
              [message.id]: message.content
            };
          }
          return prev;
        });
      }
    });
  }, [messages]);

  // Initialize scroll position to show only current conversation
  useEffect(() => {
    if (messages.length > 0) {
      // Removed auto-scrolling initialization
    }
  }, [messages.length]);

  const commandQuery = inputMessage.match(/^\/([^\s]*)$/)?.[1].toLowerCase() ?? null;
  const matchingCommands = commandQuery === null
    ? []
    : CHAT_COMMANDS.filter(command => command.name.startsWith(commandQuery));
  const showCommands = matchingCommands.length > 0;
  const activeCommandIndex = matchingCommands.length === 0
    ? 0
    : commandIndex % matchingCommands.length;

  const appendLocalNotice = (content: string, title = 'Commands') => {
    const notice: Message = {
      id: Date.now(),
      sender: 'ardi',
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    const existing = chats.find(chat => chat.id === internalCurrentChatId);
    if (!existing) {
      const chatId = Date.now().toString();
      const created: ChatData = {
        id: chatId,
        title,
        messages: [notice],
        createdAt: new Date(),
        isStarred: false
      };
      setChats(prev => [...prev, created]);
      currentChatIdRef.current = chatId;
      setInternalCurrentChatId(chatId);
      messagesRef.current = [notice];
      setMessages([notice]);
      window.dispatchEvent(new CustomEvent('new-chat-created', { detail: { chatId } }));
    } else {
      const next = [...messagesRef.current, notice];
      messagesRef.current = next;
      setMessages(next);
      updateCurrentChat(next, existing.id);
    }
    setDisplayedText(prev => ({ ...prev, [notice.id]: content }));
    setInputMessage('');
  };

  const runCommand = (name: string) => {
    if (name === 'help') {
      appendLocalNotice(HELP_REPLY);
      return;
    }
    if (name === 'stop') {
      stopGeneration();
      setInputMessage('');
      return;
    }
    if (name === 'new') {
      setShowQuestions(false);
      createNewChat();
      return;
    }
    if (name === 'questions') {
      setInputMessage('');
      setShowQuestions(true);
      return;
    }
    if (name === 'retry') {
      setInputMessage('');
      const last = [...messagesRef.current].reverse().find(message => message.sender === 'ardi');
      if (!last) {
        if (messagesRef.current.length > 0) {
          appendLocalNotice('There is no reply to retry.', 'Retry');
        }
        return;
      }
      handleRetryMessage(last.id);
    }
  };

  const composerRef = useRef<HTMLTextAreaElement>(null);
  const isGenerating = isResponding || typingMessageId !== null;
  const composerFilled = inputMessage.trim().length > 0;
  const sendButtonPosition = composerFilled
    ? 'top-1.5 translate-y-0'
    : 'top-1/2 -translate-y-1/2';

  const resizeComposer = (element: HTMLTextAreaElement) => {
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, 180)}px`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showCommands) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCommandIndex(index => (index + 1) % matchingCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCommandIndex(index => (index - 1 + matchingCommands.length) % matchingCommands.length);
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const selected = matchingCommands[activeCommandIndex];
        if (selected) setInputMessage(`/${selected.name}`);
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const selected = matchingCommands[activeCommandIndex];
        if (selected) runCommand(selected.name);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setInputMessage('');
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (showQuestions) {
        setShowQuestions(false);
        return;
      }
      sendMessage();
    }
    if (e.key === 'Escape') {
      setShowQuestions(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    resizeComposer(e.target);
    setInputMessage(value);
    if (showQuestions && value.trim() !== '' && !value.toLowerCase().startsWith('/questions')) {
      setShowQuestions(false);
    }
  };

  useEffect(() => {
    setCommandIndex(0);
  }, [commandQuery]);

  const handleQuestionSelect = (question: string) => {
    setInputMessage(question);
    setShowQuestions(false);
  };

  useEffect(() => {
    if (!composerRef.current) return;
    if (!inputMessage) {
      composerRef.current.style.height = 'auto';
      return;
    }
    resizeComposer(composerRef.current);
  }, [inputMessage]);

  const commandMenu = showCommands ? (
    <div className="mb-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
      {matchingCommands.map((command, index) => (
        <button
          key={command.name}
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onMouseEnter={() => setCommandIndex(index)}
          onClick={() => runCommand(command.name)}
          className={`flex w-full items-baseline gap-3 px-3 py-2 text-left text-sm ${
            index === activeCommandIndex
              ? 'bg-gray-100 dark:bg-gray-700'
              : 'hover:bg-gray-50 dark:hover:bg-gray-700/60'
          }`}
        >
          <span className="font-medium text-gray-900 dark:text-white">/{command.name}</span>
          <span className="text-gray-500 dark:text-gray-400">{command.description}</span>
        </button>
      ))}
    </div>
  ) : null;

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-br from-gray-50 to-white dark:bg-gray-900 dark:from-gray-900 dark:to-gray-900 h-screen relative">
      
      {/* Floating Controls - Always visible */}
      <div className="absolute top-2 sm:top-4 right-2 sm:right-4 z-50 flex items-center space-x-1 sm:space-x-2 md:space-x-3">
        <div className="relative dropdown-container">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="p-1.5 sm:p-2 md:p-3 rounded-full bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-700 hover:shadow-xl transition-all duration-200"
            title="More options"
          >
            <HiDotsVertical className="w-3 h-3 sm:w-3 sm:h-3 md:w-4 md:h-4 text-gray-600 dark:text-gray-300" />
          </button>
          
          {isDropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2">
              <button
                onClick={handleStarChat}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center space-x-3 transition-colors duration-200"
              >
                <FiStar className={`w-4 h-4 ${isStarred ? 'text-yellow-500 fill-current' : 'text-gray-600 dark:text-gray-400'}`} />
                <span>{isStarred ? 'Unstar this chat' : 'Starred'}</span>
              </button>
              <button
                onClick={handleShareChat}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center space-x-3 transition-colors duration-200"
              >
                <FiShare2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <span>Share this</span>
              </button>
              <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>
              <button
                onClick={handleDeleteChat}
                className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center space-x-3 transition-colors duration-200"
              >
                <FiTrash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
            </div>
          )}
        </div>
        <ThemeToggle />
      </div>
      
      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6">
          <div className="max-w-2xl w-full text-center">
            <h1 className="flex items-center justify-center gap-3 text-3xl sm:text-4xl font-serif font-normal mb-8 px-2 leading-tight text-gray-800 dark:text-gray-100">
              <Image
                src="/img/LogoArdi.svg"
                alt=""
                width={36}
                height={36}
                className="w-8 h-8 sm:w-9 sm:h-9"
              />
              {heroHeading}
            </h1>

            <div className="max-w-2xl mx-auto">
              {commandMenu}
              <div className="relative bg-white dark:bg-gray-800 rounded-2xl px-2 py-2 shadow-lg border border-gray-200 dark:border-gray-700">
                <button 
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title="Attach file"
                >
                  <IoMdAttach className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>
                                  <textarea
                    ref={composerRef}
                    rows={1}
                    value={inputMessage}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="How can I help you today?"
                    className="w-full resize-none overflow-y-auto pl-8 pr-11 py-2 bg-transparent border-0 rounded-xl outline-none font-normal text-base placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white"
                  />
                                  {isGenerating ? (
                    <button
                      type="button"
                      onClick={() => stopGeneration()}
                      className={`absolute right-1.5 ${sendButtonPosition} p-1.5 rounded-lg text-white bg-gray-900 hover:bg-black dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200 transition-all duration-300 ease-out`}
                      title="Stop response"
                    >
                      <IoStop className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={sendMessage}
                      disabled={inputMessage.trim() === ''}
                      className={`absolute right-2 ${sendButtonPosition} p-1 text-gray-800 dark:text-gray-100 transition-opacity duration-200 disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-70`}
                    >
                      <IoMdSend className="w-5 h-5" />
                    </button>
                  )}
              </div>
              <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                Ardi is AI and can make mistakes.
              </p>
            </div>
          </div>
        </div>
      ) : (
        // Chat mode - Enhanced with conversation-focused scrolling
        <>
          {/* Messages Container - Enhanced with better conversation management */}
          <div 
            ref={messagesContainerRef} 
            className="flex-1 overflow-y-auto pb-16 sm:pb-20 px-2 sm:px-4 md:px-6 scroll-smooth" 
          >
            <div className="max-w-5xl mx-auto w-full pt-4 sm:pt-8 pb-4 space-y-4 sm:space-y-8">
              <ChatMessages
                messages={messages}
                displayedText={displayedText}
                typingMessageId={typingMessageId}
                isTyping={isTyping || isResponding}
                onRetryMessage={handleRetryMessage}
                onEditMessage={handleEditMessage}
              />
              {/* Scroll target */}
              <div ref={messagesEndRef} style={{ height: '1px' }} />
            </div>
          </div>

          {/* Enhanced Floating Input Area */}
          <div className="absolute bottom-2 sm:bottom-4 md:bottom-6 left-2 right-2 sm:left-4 sm:right-4 md:left-6 md:right-6 z-20">
            <div className="max-w-4xl mx-auto">
              {/* Questions Dropdown */}
              {commandMenu}
              {showQuestions && (
                <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 mb-2 sm:mb-4 max-h-60 sm:max-h-80 overflow-y-auto">
                  <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Suggested Questions</h3>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">Click on any question to ask Ardi</p>
                  </div>
                  <div className="p-1 sm:p-2">
                    {suggestedQuestions.map((question, index) => (
                      <button
                        key={index}
                        onClick={() => handleQuestionSelect(question)}
                        className="w-full text-left p-2 sm:p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 text-gray-900 dark:text-white text-xs sm:text-sm border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700">
                <div className="relative px-2 py-1.5">
                  <button 
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="Attach file"
                  >
                    <IoMdAttach className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  </button>
                  <textarea
                    ref={composerRef}
                    rows={1}
                    value={inputMessage}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Reply"
                    className="w-full resize-none overflow-y-auto bg-transparent border-none outline-none pl-8 pr-11 py-1.5 text-base text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  />
                  {isGenerating ? (
                    <button
                      type="button"
                      onClick={() => stopGeneration()}
                      className={`absolute right-1.5 ${sendButtonPosition} p-1.5 rounded-lg text-white bg-gray-900 hover:bg-black dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200 transition-all duration-300 ease-out`}
                      title="Stop response"
                    >
                      <IoStop className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={sendMessage}
                      disabled={inputMessage.trim() === ''}
                      className={`absolute right-2 ${sendButtonPosition} p-1 text-gray-800 dark:text-gray-100 transition-opacity duration-200 disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-70`}
                    >
                      <IoMdSend className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
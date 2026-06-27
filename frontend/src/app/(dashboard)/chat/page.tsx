'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { message, Button } from 'antd';
import { ArrowLeftOutlined, InfoCircleOutlined } from '@ant-design/icons';
import Skeleton from '@/components/ui/Loading/Skeleton';
import {
  ConversationList,
  ChatWindow,
  RightPanel,
} from '@/components/chat';
import { conversationApi } from '@/lib/api';
import { platformApi } from '@/lib/api/platform';
import { useConversationStore } from '@/store/conversationStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Message } from '@/types';

type MobileView = 'list' | 'chat' | 'detail';

export default function ChatPage() {
  const searchParams = useSearchParams();
  const initialId = searchParams.get('id');

  const [selectedId, setSelectedId] = useState<string | null>(initialId);
  const [inputValue, setInputValue] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [sending, setSending] = useState(false);
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileView, setMobileView] = useState<MobileView>('list');

  // Zustand selector
  const conversations = useConversationStore(s => s.conversations);
  const currentConversation = useConversationStore(s => s.currentConversation);
  const messages = useConversationStore(s => s.messages);
  const isLoading = useConversationStore(s => s.isLoading);
  const pagination = useConversationStore(s => s.pagination);
  const statusFilter = useConversationStore(s => s.statusFilter);
  const platformFilter = useConversationStore(s => s.platformFilter);
  const ragSources = useConversationStore(s => s.ragSources);
  const fetchConversations = useConversationStore(s => s.fetchConversations);
  const selectConversation = useConversationStore(s => s.selectConversation);
  const addMessage = useConversationStore(s => s.addMessage);
  const closeConversation = useConversationStore(s => s.closeConversation);
  const setStatusFilter = useConversationStore(s => s.setStatusFilter);
  const setPlatformFilter = useConversationStore(s => s.setPlatformFilter);
  const setWsStatus = useConversationStore(s => s.setWsStatus);
  const startStreamingMessage = useConversationStore(s => s.startStreamingMessage);
  const appendStreamChunk = useConversationStore(s => s.appendStreamChunk);
  const finalizeStreamingMessage = useConversationStore(s => s.finalizeStreamingMessage);
  const setRagSources = useConversationStore(s => s.setRagSources);
  const takeoverConversation = useConversationStore(s => s.takeoverConversation);

  const streamingIdRef = useRef<string | null>(null);

  const fetchConversationsRef = useRef(fetchConversations);
  fetchConversationsRef.current = fetchConversations;

  // Responsive detection
  const handleResize = useCallback(() => {
    setIsMobile(window.innerWidth < 768);
  }, []);

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  // Initial load + 30s polling
  useEffect(() => {
    fetchConversationsRef.current();
    const timer = setInterval(() => fetchConversationsRef.current(), 30000);
    return () => clearInterval(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch when filter changes
  useEffect(() => {
    fetchConversations({ page: 1 });
  }, [statusFilter, platformFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load conversation detail when selected
  useEffect(() => {
    if (selectedId) {
      selectConversation(selectedId);
      setRagSources([]);
    }
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // WebSocket
  const { sendMessage: wsSend } = useWebSocket({
    conversationId: selectedId || '',
    stream: true,
    autoConnect: !!selectedId,
    onConnect: () => setWsStatus('connected'),
    onDisconnect: () => setWsStatus('disconnected'),
    onMessage: (msg) => {
      if (msg.type === 'stream') {
        const chunk = msg.chunk ?? msg.content ?? '';
        if (!streamingIdRef.current) {
          streamingIdRef.current = startStreamingMessage(selectedId!);
        }
        appendStreamChunk(streamingIdRef.current, chunk);
        if (msg.is_final) {
          finalizeStreamingMessage(streamingIdRef.current);
          streamingIdRef.current = null;
        }
      } else if (msg.type === 'message') {
        if (streamingIdRef.current) {
          finalizeStreamingMessage(streamingIdRef.current);
          streamingIdRef.current = null;
        }
        if (msg.role === 'assistant' && msg.content) {
          const newMsg: Message = {
            id: Date.now(),
            message_id: `ws-${Date.now()}`,
            conversation_id: selectedId!,
            role: 'assistant',
            content: msg.content,
            created_at: msg.timestamp || new Date().toISOString(),
            input_tokens: msg.tokens?.input || 0,
            output_tokens: msg.tokens?.output || 0,
          };
          addMessage(newMsg);
        }
      } else if (msg.type === 'metadata' && msg.sources) {
        setRagSources(
          msg.sources.map((s) => ({
            knowledge_id: s.knowledge_id,
            title: s.title,
            content: '',
            score: s.score,
            source: s.title,
          }))
        );
      } else if (msg.type === 'error') {
        message.error(msg.content || '消息处理出错');
      }
    },
  });

  const handleSelectConversation = (id: string) => {
    setSelectedId(id);
    if (isMobile) setMobileView('chat');
  };

  const handleCreateConversation = async () => {
    setCreatingConversation(true);
    try {
      const userId = `manual_${Date.now()}`;
      const response = await conversationApi.create({
        user_id: userId,
        channel: 'manual',
        metadata: { source: 'dashboard_manual_create' },
      });
      if (response.success && response.data) {
        await fetchConversations({ page: 1 });
        setSelectedId(response.data.conversation_id);
        if (isMobile) setMobileView('chat');
        message.success('新会话已创建，可以开始模拟消息');
      } else {
        message.error(response.error?.message || '新建会话失败');
      }
    } catch {
      message.error('新建会话失败');
    } finally {
      setCreatingConversation(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !selectedId) return;

    const userMsg: Message = {
      id: Date.now(),
      message_id: `msg-${Date.now()}`,
      conversation_id: selectedId,
      role: 'user',
      content: inputValue,
      created_at: new Date().toISOString(),
      input_tokens: 0,
      output_tokens: 0,
    };
    addMessage(userMsg);
    const content = inputValue;
    setInputValue('');

    if (currentConversation?.status === 'waiting') {
      setSending(true);
      try {
        if (currentConversation.platform_type === 'pinduoduo') {
          const response = await platformApi.sendPlatformMessage(selectedId, content);
          if (!response.success) message.error('发送失败');
        } else if (currentConversation.platform_type === 'douyin') {
          const response = await platformApi.sendDouyinMessage(selectedId, content);
          if (!response.success) message.error('发送失败');
        } else {
          const response = await conversationApi.sendMessage(selectedId, { content });
          if (!response.success) message.error(response.error?.message || '发送失败');
        }
      } catch {
        message.error('发送消息失败');
      } finally {
        setSending(false);
      }
    } else {
      wsSend(content, true);
    }
  };

  const handleCloseConversation = async () => {
    if (!selectedId) return;
    await closeConversation(selectedId);
    message.success('会话已结束');
  };

  const handleTakeover = async () => {
    if (!selectedId) return;
    await takeoverConversation(selectedId);
    message.success('已接管会话，切换至人工模式');
  };

  const handleStatusFilterChange = (status: 'all' | 'active' | 'waiting' | 'closed') => {
    setStatusFilter(status);
  };

  const handlePageChange = (page: number) => {
    fetchConversations({ page });
  };

  // Filter by search locally
  const filteredConversations = conversations.filter((c) => {
    if (!searchValue) return true;
    const s = searchValue.toLowerCase();
    return (
      c.conversation_id.toLowerCase().includes(s) ||
      c.user_external_id.toLowerCase().includes(s) ||
      c.last_message_preview?.toLowerCase().includes(s)
    );
  });

  if (isLoading && conversations.length === 0) {
    return (
      <div className="h-[calc(100vh-64px-48px)] flex bg-white rounded-lg overflow-hidden shadow">
        <div className="w-80 flex-shrink-0 border-r border-neutral-200 p-4 max-md:hidden">
          <Skeleton variant="rectangular" height={36} className="mb-4" />
          <Skeleton variant="list" rows={6} />
        </div>
        <div className="flex-1 p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-neutral-200">
            <Skeleton variant="circular" width={40} height={40} />
            <div className="flex-1">
              <Skeleton variant="text" width="30%" />
              <Skeleton variant="text" width="20%" className="mt-1" />
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex justify-start">
              <Skeleton variant="rectangular" width="60%" height={48} />
            </div>
            <div className="flex justify-end">
              <Skeleton variant="rectangular" width="50%" height={36} />
            </div>
            <div className="flex justify-start">
              <Skeleton variant="rectangular" width="70%" height={60} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Mobile: three-level navigation
  if (isMobile) {
    return (
      <div className="h-[calc(100vh-64px-48px)] bg-white rounded-lg overflow-hidden shadow animate-fade-in">
        {mobileView === 'list' && (
          <ConversationList
            conversations={filteredConversations}
            selectedId={selectedId}
            onSelect={handleSelectConversation}
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            statusFilter={statusFilter}
            onStatusFilterChange={handleStatusFilterChange}
            platformFilter={platformFilter}
            onPlatformFilterChange={setPlatformFilter}
            pagination={pagination}
            onPageChange={handlePageChange}
            loading={isLoading}
            onCreateConversation={handleCreateConversation}
            creating={creatingConversation}
          />
        )}
        {mobileView === 'chat' && (
          <div className="h-full flex flex-col">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-200 bg-white">
              <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => setMobileView('list')} size="small" />
              <span className="text-sm font-medium flex-1">对话</span>
              <Button type="text" icon={<InfoCircleOutlined />} onClick={() => setMobileView('detail')} size="small" />
            </div>
            <div className="flex-1 overflow-hidden">
              <ChatWindow
                conversation={currentConversation}
                messages={messages}
                inputValue={inputValue}
                onInputChange={setInputValue}
                onSend={handleSendMessage}
                onClose={handleCloseConversation}
                onTakeover={handleTakeover}
                sending={sending}
                loading={isLoading && !!selectedId && !currentConversation}
                onCreateConversation={handleCreateConversation}
                creating={creatingConversation}
              />
            </div>
          </div>
        )}
        {mobileView === 'detail' && (
          <div className="h-full flex flex-col">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-200 bg-white">
              <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => setMobileView('chat')} size="small" />
              <span className="text-sm font-medium">详情</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              <RightPanel user={currentConversation?.user || null} ragSources={ragSources} />
            </div>
          </div>
        )}
      </div>
    );
  }

  // Desktop: three-column layout
  return (
    <div className="h-[calc(100vh-64px-48px)] flex bg-white rounded-lg overflow-hidden shadow animate-fade-in">
      {/* Conversation List */}
      <div className="w-80 flex-shrink-0">
        <ConversationList
          conversations={filteredConversations}
          selectedId={selectedId}
          onSelect={handleSelectConversation}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          statusFilter={statusFilter}
          onStatusFilterChange={handleStatusFilterChange}
          platformFilter={platformFilter}
          onPlatformFilterChange={setPlatformFilter}
          pagination={pagination}
          onPageChange={handlePageChange}
          loading={isLoading}
          onCreateConversation={handleCreateConversation}
          creating={creatingConversation}
        />
      </div>

      {/* Chat Window */}
      <ChatWindow
        conversation={currentConversation}
        messages={messages}
        inputValue={inputValue}
        onInputChange={setInputValue}
        onSend={handleSendMessage}
        onClose={handleCloseConversation}
        onTakeover={handleTakeover}
        sending={sending}
        loading={isLoading && !!selectedId && !currentConversation}
        onCreateConversation={handleCreateConversation}
        creating={creatingConversation}
      />

      {/* Right Panel - Collapsible */}
      {rightPanelOpen && selectedId && (
        <RightPanel user={currentConversation?.user || null} ragSources={ragSources} />
      )}
      {selectedId && !rightPanelOpen && (
        <div className="border-l border-neutral-200">
          <Button
            type="text"
            icon={<InfoCircleOutlined />}
            onClick={() => setRightPanelOpen(true)}
            className="m-2"
            title="展开详情面板"
          />
        </div>
      )}
    </div>
  );
}

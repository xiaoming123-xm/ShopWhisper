'use client';

import { useEffect, useRef } from 'react';
import { Button, Input, Tag, Typography } from 'antd';
import Skeleton from '@/components/ui/Loading/Skeleton';
import { SendOutlined } from '@ant-design/icons';
import MessageBubble from './MessageBubble';
import { Message, ConversationDetail } from '@/types';

const { Text } = Typography;
const { TextArea } = Input;

interface ChatWindowProps {
  conversation: ConversationDetail | null;
  messages: Message[];
  inputValue: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onClose: () => void;
  onTakeover: () => void;
  sending?: boolean;
  loading?: boolean;
  onCreateConversation?: () => void;
  creating?: boolean;
}

export default function ChatWindow({
  conversation,
  messages,
  inputValue,
  onInputChange,
  onSend,
  onClose,
  onTakeover,
  sending = false,
  loading = false,
  onCreateConversation,
  creating = false,
}: ChatWindowProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  };

  const formatUserId = (id: string) => {
    if (id.startsWith('VIP')) return id;
    return `访客 #${id.slice(-4)}`;
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-neutral-50 text-center px-8">
        <div className="w-20 h-20 rounded-full bg-brand-100 flex items-center justify-center mb-4">
          <SendOutlined className="text-3xl text-brand-400" />
        </div>
        <Text strong className="text-lg mb-2">选择一个会话开始</Text>
        <Text type="secondary" className="text-sm max-w-xs">
          从左侧列表选择一个会话，或新建一个空会话进行模拟。
        </Text>
        {onCreateConversation && (
          <Button
            type="primary"
            icon={<SendOutlined />}
            loading={creating}
            onClick={onCreateConversation}
            className="mt-5"
          >
            新建会话
          </Button>
        )}
      </div>
    );
  }

  const isClosed = conversation.status === 'closed';
  const isWaiting = conversation.status === 'waiting';

  return (
    <div className="flex-1 flex flex-col bg-neutral-50">
      <div className="h-16 px-5 flex items-center justify-between bg-white border-b border-neutral-200">
        <div className="flex items-center gap-3">
          <Text strong>{formatUserId(conversation.user_external_id)}</Text>
          {isWaiting ? (
            <Tag color="orange">人工接管中</Tag>
          ) : (
            <Tag color={conversation.status === 'active' ? 'green' : 'default'}>
              {conversation.status === 'active' ? '在线' : '已结束'}
            </Tag>
          )}
        </div>
        <div className="flex gap-2">
          <Button danger onClick={onClose} disabled={isClosed}>
            结束会话
          </Button>
          <Button type="primary" onClick={onTakeover} disabled={isWaiting || isClosed}>
            人工接管
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="space-y-4 p-4">
            <div className="flex justify-start">
              <Skeleton variant="rectangular" width="55%" height={44} />
            </div>
            <div className="flex justify-end">
              <Skeleton variant="rectangular" width="45%" height={36} />
            </div>
            <div className="flex justify-start">
              <Skeleton variant="rectangular" width="65%" height={56} />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <MessageBubble key={message.message_id} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="p-5 bg-white border-t border-neutral-200">
        <TextArea
          value={inputValue}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={handleKeyPress}
          placeholder={isClosed ? '会话已结束' : '输入回复内容...'}
          autoSize={{ minRows: 3, maxRows: 6 }}
          className="mb-3"
          disabled={isClosed}
        />
        <div className="flex items-center justify-between">
          <Text type="secondary" className="text-sm">
            快捷键 <Tag>Shift+Enter</Tag> 换行
          </Text>
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={onSend}
            loading={sending}
            disabled={!inputValue.trim() || isClosed}
          >
            发送
          </Button>
        </div>
      </div>
    </div>
  );
}

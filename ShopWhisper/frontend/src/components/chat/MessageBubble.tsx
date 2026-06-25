'use client';

import { memo } from 'react';
import { Typography } from 'antd';
import { Message } from '@/types';

const { Text } = Typography;

interface MessageBubbleProps {
  message: Message;
}

function renderContent(content: string) {
  return content.split('\n').map((line, i, arr) => (
    <span key={i}>
      {line}
      {i < arr.length - 1 && <br />}
    </span>
  ));
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isStreaming = message.isStreaming === true;

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  if (isSystem) {
    return (
      <div className="text-center py-2">
        <Text type="secondary" className="text-xs px-3 py-1 rounded-full bg-brand-100">
          {message.content}
        </Text>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[70%] px-4 py-3 shadow-sm ${
          isUser
            ? 'rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl bg-white border border-neutral-200'
            : 'rounded-tl-2xl rounded-tr-sm rounded-br-2xl rounded-bl-2xl bg-brand-100 border border-brand-200'
        }`}
      >
        <div className="text-sm leading-relaxed text-brand-950">
          {renderContent(message.content)}
          {isStreaming && (
            <span className="inline-block w-0.5 h-4 bg-brand-500 ml-0.5 animate-pulse align-middle" />
          )}
        </div>
        {!isStreaming && (
          <div className={`text-xs mt-2 ${isUser ? 'text-left' : 'text-right'}`}>
            <Text type="secondary" className="text-[0.7rem]">
              {formatTime(message.created_at)}
            </Text>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(MessageBubble);
'use client';

import { memo } from 'react';
import { Button, Input, List, Tag, Typography, Segmented, Pagination, Select } from 'antd';
import Skeleton from '@/components/ui/Loading/Skeleton';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { Conversation } from '@/types';

const { Text } = Typography;

type StatusFilter = 'all' | 'active' | 'waiting' | 'closed';

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading?: boolean;
  searchValue: string;
  onSearchChange: (value: string) => void;
  statusFilter?: StatusFilter;
  onStatusFilterChange?: (status: StatusFilter) => void;
  platformFilter?: string;
  onPlatformFilterChange?: (platform: string | undefined) => void;
  pagination?: { page: number; total: number; size: number };
  onPageChange?: (page: number) => void;
  onCreateConversation?: () => void;
  creating?: boolean;
}

const statusConfig: Record<string, { color: string; text: string }> = {
  active: { color: 'green', text: 'AI 处理中' },
  waiting: { color: 'red', text: '待人工接入' },
  closed: { color: 'default', text: '已结束' },
};

const filterOptions = [
  { label: '全部', value: 'all' },
  { label: 'AI处理', value: 'active' },
  { label: '待接入', value: 'waiting' },
  { label: '已结束', value: 'closed' },
];

function ConversationList({
  conversations,
  selectedId,
  onSelect,
  loading = false,
  searchValue,
  onSearchChange,
  statusFilter = 'all',
  onStatusFilterChange,
  platformFilter,
  onPlatformFilterChange,
  pagination,
  onPageChange,
  onCreateConversation,
  creating = false,
}: ConversationListProps) {
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  const formatUserId = (id: string) => {
    if (id.startsWith('VIP')) return id;
    return `访客 #${id.slice(-4)}`;
  };

  const getPlatformLabel = (platform: string): string => {
    const labels: Record<string, string> = {
      pinduoduo: '拼多多',
      douyin: '抖音抖店',
      taobao: '淘宝',
      jd: '京东',
    };
    return labels[platform] || platform;
  };

  const getPlatformColor = (platform: string): string => {
    const colors: Record<string, string> = {
      pinduoduo: 'orange',
      douyin: 'geekblue',
      taobao: 'red',
      jd: 'blue',
    };
    return colors[platform] || 'default';
  };

  return (
    <div className="h-full flex flex-col bg-white border-r border-gray-200">
      {/* Search */}
      <div className="p-4 border-b border-gray-200 space-y-2">
        {onCreateConversation && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            block
            loading={creating}
            onClick={onCreateConversation}
          >
            新建会话
          </Button>
        )}
        <Input
          prefix={<SearchOutlined className="text-gray-400" />}
          placeholder="搜索会话ID或用户..."
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          allowClear
        />
        {onStatusFilterChange && (
          <Segmented
            block
            size="small"
            options={filterOptions}
            value={statusFilter}
            onChange={(v) => onStatusFilterChange(v as StatusFilter)}
          />
        )}
        {onPlatformFilterChange && (
          <Select
            placeholder="全部平台"
            allowClear
            style={{ width: '100%' }}
            size="small"
            value={platformFilter}
            onChange={onPlatformFilterChange}
            options={[
              { value: 'pinduoduo', label: '拼多多' },
              { value: 'douyin', label: '抖音抖店' },
              { value: 'taobao', label: '淘宝' },
              { value: 'jd', label: '京东' },
            ]}
          />
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-3">
            <Skeleton variant="list" rows={5} />
          </div>
        ) : (
          <List
            dataSource={conversations}
            renderItem={(item) => {
              const isSelected = selectedId === item.conversation_id;
              const status = statusConfig[item.status] || statusConfig.closed;

              return (
                <div
                  className={`
                    px-4 py-3 cursor-pointer transition-colors border-b border-gray-100
                    ${isSelected ? 'bg-brand-50 border-l-4 border-l-brand-500' : 'hover:bg-neutral-50'}
                  `}
                  onClick={() => onSelect(item.conversation_id)}
                >
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2">
                      {item.platform_type && (
                        <Tag color={getPlatformColor(item.platform_type)} className="text-xs">
                          {getPlatformLabel(item.platform_type)}
                        </Tag>
                      )}
                      <Text strong className="text-sm">
                        {formatUserId(item.user_external_id)}
                      </Text>
                    </div>
                    <Text type="secondary" className="text-xs">
                      {item.last_message_at
                        ? formatTime(item.last_message_at)
                        : formatTime(item.started_at)}
                    </Text>
                  </div>
                  <Text type="secondary" className="text-sm block truncate mb-2">
                    {item.last_message_preview || '暂无消息'}
                  </Text>
                  <Tag color={status.color} className="text-xs">
                    {status.text}
                  </Tag>
                </div>
              );
            }}
          />
        )}
      </div>

      {/* Pagination */}
      {pagination && onPageChange && pagination.total > pagination.size && (
        <div className="p-3 border-t border-gray-200 flex justify-center">
          <Pagination
            simple
            size="small"
            current={pagination.page}
            total={pagination.total}
            pageSize={pagination.size}
            onChange={onPageChange}
          />
        </div>
      )}
    </div>
  );
}

export default memo(ConversationList);

'use client';

import { useState } from 'react';
import { Table, Tag, Typography, Button, message } from 'antd';
import { SyncOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import Link from 'next/link';
import { PaymentOrderInfo, PaymentOrderStatus } from '@/types/admin';
import { adminPaymentsApi } from '@/lib/api/admin';

const { Text } = Typography;

interface OrderTableProps {
  orders: PaymentOrderInfo[];
  loading?: boolean;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number, pageSize: number) => void;
  onRefresh?: () => void;
}

const statusConfig: Record<PaymentOrderStatus, { color: string; label: string }> = {
  pending: { color: 'orange', label: '待支付' },
  paid: { color: 'green', label: '已支付' },
  failed: { color: 'red', label: '支付失败' },
  refunded: { color: 'default', label: '已退款' },
  cancelled: { color: 'default', label: '已取消' },
};

const paymentMethodLabels: Record<string, string> = {
  alipay: '支付宝',
};

const planTypeLabels: Record<string, string> = {
  monthly: '月付',
  quarterly: '季付',
  semi_annual: '半年付',
  annual: '年付',
  image_addon: '图片加量包',
  video_addon: '视频加量包',
};

const subscriptionTypeLabels: Record<string, string> = {
  new: '新购',
  renewal: '续费',
  upgrade: '升级',
  addon: '加量包',
};

export default function OrderTable({
  orders,
  loading,
  total,
  page,
  pageSize,
  onPageChange,
  onRefresh,
}: OrderTableProps) {
  const [syncingOrders, setSyncingOrders] = useState<Set<string>>(new Set());

  const handleSync = async (orderNumber: string) => {
    setSyncingOrders(prev => new Set(prev).add(orderNumber));
    try {
      const res = await adminPaymentsApi.syncOrder(orderNumber);
      if (res.success) {
        message.success('订单状态已同步');
        onRefresh?.();
      } else {
        message.error('同步失败');
      }
    } catch {
      message.error('同步请求失败');
    } finally {
      setSyncingOrders(prev => { const s = new Set(prev); s.delete(orderNumber); return s; });
    }
  };

  const columns: ColumnsType<PaymentOrderInfo> = [
    {
      title: '订单号',
      dataIndex: 'order_number',
      key: 'order_number',
      width: 180,
      ellipsis: true,
    },
    {
      title: '类型',
      key: 'type',
      width: 140,
      render: (_, record) =>
        `${subscriptionTypeLabels[record.subscription_type] || record.subscription_type} · ${planTypeLabels[record.plan_type] || record.plan_type}`,
    },
    {
      title: '租户',
      key: 'tenant',
      width: 150,
      render: (_, record) => (
        <Link href={`/tenants/${record.tenant_id}`} className="text-blue-600">
          {record.company_name || record.tenant_id.slice(0, 8) + '...'}
        </Link>
      ),
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      render: (amount: number) => (
        <Text strong>¥{amount.toFixed(2)}</Text>
      ),
    },
    {
      title: '支付方式',
      dataIndex: 'payment_channel',
      key: 'payment_channel',
      width: 100,
      render: (method: string) => paymentMethodLabels[method] || method,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: PaymentOrderStatus) => {
        const config = statusConfig[status] || { color: 'default', label: status };
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '支付时间',
      dataIndex: 'paid_at',
      key: 'paid_at',
      width: 180,
      render: (date: string | null) => date ? new Date(date).toLocaleString('zh-CN') : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) =>
        record.status === 'pending' ? (
          <Button
            size="small"
            icon={<SyncOutlined spin={syncingOrders.has(record.order_number)} />}
            loading={syncingOrders.has(record.order_number)}
            onClick={() => handleSync(record.order_number)}
          >
            同步
          </Button>
        ) : null,
    },
  ];

  return (
    <Table
      dataSource={orders}
      columns={columns}
      rowKey="order_number"
      loading={loading}
      pagination={{
        current: page,
        pageSize,
        total,
        showSizeChanger: true,
        showQuickJumper: true,
        showTotal: (total) => `共 ${total} 条`,
        onChange: onPageChange,
      }}
      scroll={{ x: 1240 }}
    />
  );
}

'use client';

import { useState } from 'react';
import { Modal, Tabs, Form, InputNumber, Input, Button, message, Descriptions, Tag } from 'antd';
import { adminTenantsApi } from '@/lib/api/admin';
import { SubscriptionInfo } from '@/types/admin';

interface SubscriptionManagementFormProps {
  tenantId: string;
  subscription?: SubscriptionInfo;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function SubscriptionManagementForm({
  tenantId,
  subscription,
  open,
  onClose,
  onSuccess,
}: SubscriptionManagementFormProps) {
  const [extendForm] = Form.useForm();
  const [suspendForm] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleExtend = async () => {
    try {
      const values = await extendForm.validateFields();
      setLoading(true);
      const response = await adminTenantsApi.extendSubscription(tenantId, values.days);
      if (response.success) {
        message.success('订阅时间延长成功');
        extendForm.resetFields();
        onSuccess();
        onClose();
      } else {
        message.error(response.error?.message || '操作失败');
      }
    } catch (error) {
      console.error('Extend subscription failed:', error);
      message.error('操作失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = async () => {
    try {
      const values = await suspendForm.validateFields();
      setLoading(true);
      const response = await adminTenantsApi.suspendSubscription(tenantId, values.reason);
      if (response.success) {
        message.success('订阅已暂停');
        suspendForm.resetFields();
        onSuccess();
        onClose();
      } else {
        message.error(response.error?.message || '操作失败');
      }
    } catch (error) {
      console.error('Suspend subscription failed:', error);
      message.error('操作失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async () => {
    try {
      setLoading(true);
      const response = await adminTenantsApi.activateSubscription(tenantId);
      if (response.success) {
        message.success('订阅已激活');
        onSuccess();
        onClose();
      } else {
        message.error(response.error?.message || '操作失败');
      }
    } catch (error) {
      console.error('Activate subscription failed:', error);
      message.error('操作失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const statusColor: Record<string, string> = {
    active: 'green',
    expired: 'red',
    cancelled: 'orange',
    pending: 'blue',
  };

  const tabItems = [
    {
      key: 'info',
      label: '订阅信息',
      children: subscription ? (
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="套餐类型">{subscription.plan_type}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={statusColor[subscription.status] || 'default'}>{subscription.status}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="开始日期">{subscription.start_date}</Descriptions.Item>
          <Descriptions.Item label="到期日期">{subscription.expire_at}</Descriptions.Item>
          <Descriptions.Item label="试用">{subscription.is_trial ? '是' : '否'}</Descriptions.Item>
        </Descriptions>
      ) : (
        <p className="text-gray-400">暂无订阅信息</p>
      ),
    },
    {
      key: 'extend',
      label: '延长时间',
      children: (
        <Form form={extendForm} layout="vertical">
          <Form.Item
            name="days"
            label="延长天数"
            rules={[{ required: true, message: '请输入延长天数' }]}
          >
            <InputNumber min={1} max={3650} className="w-full" placeholder="请输入天数" />
          </Form.Item>
          <Button type="primary" loading={loading} onClick={handleExtend} block>
            确认延长
          </Button>
        </Form>
      ),
    },
    {
      key: 'suspend',
      label: '暂停 / 激活',
      children: (
        <div className="space-y-4">
          <Form form={suspendForm} layout="vertical">
            <Form.Item name="reason" label="暂停原因">
              <Input.TextArea rows={3} placeholder="请输入暂停原因（选填）" />
            </Form.Item>
            <Button danger loading={loading} onClick={handleSuspend} block>
              暂停订阅
            </Button>
          </Form>
          <Button type="primary" loading={loading} onClick={handleActivate} block>
            激活订阅
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Modal
      title="管理订阅"
      open={open}
      onCancel={onClose}
      footer={null}
      width={520}
    >
      <Tabs items={tabItems} />
    </Modal>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Card, Tabs, message, Modal, Tag, Typography, Select, Form,
  InputNumber, Button, Table, Space, Input,
} from 'antd';
import Skeleton from '@/components/ui/Loading/Skeleton';
import type { TabsProps, TableColumnsType } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { TenantDetailCard } from '@/components/admin/tenants';
import { SubscriptionManagementForm } from '@/components/admin/tenants';
import { adminTenantsApi, adminSubscriptionsApi } from '@/lib/api/admin';
import { adminPaymentsApi } from '@/lib/api/admin/payments';
import { TenantInfo, SubscriptionInfo, BillInfo, AdminPaginatedResponse } from '@/types/admin';

const { Title, Text } = Typography;

export default function TenantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.tenantId as string;

  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [planForm] = Form.useForm();

  // Bills tab state
  const [billsData, setBillsData] = useState<AdminPaginatedResponse<BillInfo> | null>(null);
  const [billsLoading, setBillsLoading] = useState(false);
  const [billsPage, setBillsPage] = useState(1);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundBillId, setRefundBillId] = useState<string | null>(null);
  const [refundForm] = Form.useForm();

  useEffect(() => {
    fetchTenantData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const fetchTenantData = async () => {
    setLoading(true);
    try {
      const tenantRes = await adminTenantsApi.get(tenantId);
      if (tenantRes.success && tenantRes.data) {
        setTenant(tenantRes.data);
      }
      try {
        const subRes = await adminSubscriptionsApi.getTenantSubscription(tenantId);
        if (subRes.success && subRes.data) {
          setSubscription(subRes.data);
        }
      } catch {
        // Subscription may not exist
      }
    } catch (error) {
      console.error('Failed to fetch tenant:', error);
      message.error('加载租户信息失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchBillsData = async (page: number) => {
    setBillsLoading(true);
    try {
      const res = await adminPaymentsApi.listBills({ tenant_id: tenantId, page, page_size: 10 });
      if (res.success && res.data) {
        setBillsData(res.data);
      }
    } catch {
      message.error('加载账单数据失败');
    } finally {
      setBillsLoading(false);
    }
  };

  const handleStatusChange = async (status: 'active' | 'suspended') => {
    Modal.confirm({
      title: `确认${status === 'active' ? '启用' : '停用'}租户？`,
      onOk: async () => {
        try {
          const response = await adminTenantsApi.updateStatus(tenantId, {
            status,
            reason: status === 'suspended' ? '管理员手动停用' : '管理员手动启用',
          });
          if (response.success) {
            message.success('状态更新成功');
            fetchTenantData();
          } else {
            message.error(response.error?.message || '操作失败');
          }
        } catch {
          message.error('操作失败');
        }
      },
    });
  };

  const handleResetApiKey = async () => {
    Modal.confirm({
      title: '确认重置 API Key？',
      content: '重置后原有的 API Key 将立即失效',
      onOk: async () => {
        try {
          const response = await adminTenantsApi.resetApiKey(tenantId);
          if (response.success && response.data) {
            Modal.success({
              title: 'API Key 已重置',
              content: (
                <div>
                  <p>新的 API Key：</p>
                  <code className="block bg-gray-100 p-2 mt-2 break-all">
                    {response.data.api_key}
                  </code>
                </div>
              ),
              width: 500,
            });
          } else {
            message.error(response.error?.message || '重置失败');
          }
        } catch {
          message.error('重置失败');
        }
      },
    });
  };

  const handleAssignPlan = async () => {
    try {
      const values = await planForm.validateFields();
      const response = await adminTenantsApi.assignPlan(
        tenantId,
        values.plan_type,
        values.duration_months
      );
      if (response.success) {
        message.success('套餐分配成功');
        setPlanModalOpen(false);
        planForm.resetFields();
        fetchTenantData();
      } else {
        message.error(response.error?.message || '操作失败');
      }
    } catch {
      message.error('操作失败');
    }
  };

  const handleApproveBill = async (billId: string) => {
    try {
      const res = await adminPaymentsApi.approveBill(billId);
      if (res.success) {
        message.success('审核通过');
        fetchBillsData(billsPage);
      } else {
        message.error(res.error?.message || '操作失败');
      }
    } catch {
      message.error('操作失败');
    }
  };

  const handleRejectBill = async (billId: string) => {
    Modal.confirm({
      title: '确认拒绝该账单？',
      content: <Input.TextArea id="reject-reason" placeholder="请输入拒绝原因" />,
      onOk: async () => {
        const reason = (document.getElementById('reject-reason') as HTMLTextAreaElement)?.value || '管理员拒绝';
        try {
          const res = await adminPaymentsApi.rejectBill(billId, reason);
          if (res.success) {
            message.success('已拒绝');
            fetchBillsData(billsPage);
          } else {
            message.error(res.error?.message || '操作失败');
          }
        } catch {
          message.error('操作失败');
        }
      },
    });
  };

  const handleRefund = async () => {
    if (!refundBillId) return;
    try {
      const values = await refundForm.validateFields();
      const res = await adminPaymentsApi.refund(refundBillId, values.reason, values.amount);
      if (res.success) {
        message.success('退款成功');
        setRefundModalOpen(false);
        refundForm.resetFields();
        setRefundBillId(null);
        fetchBillsData(billsPage);
      } else {
        message.error(res.error?.message || '操作失败');
      }
    } catch {
      message.error('操作失败');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton variant="rectangular" width={80} height={32} />
          <Skeleton variant="text" width="30%" height={28} />
        </div>
        <div className="bg-white rounded-xl p-5 border border-neutral-200">
          <Skeleton variant="text" width="20%" className="mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i}>
                <Skeleton variant="text" width="60%" />
                <Skeleton variant="rectangular" height={24} className="mt-2" />
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-neutral-200">
          <Skeleton variant="table" rows={4} />
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="text-center py-20">
        <Text type="secondary">租户不存在或已被删除</Text>
      </div>
    );
  }

  const billStatusConfig: Record<string, { color: string; label: string }> = {
    pending: { color: 'orange', label: '待审核' },
    approved: { color: 'blue', label: '已审核' },
    paid: { color: 'green', label: '已支付' },
    overdue: { color: 'red', label: '已逾期' },
    rejected: { color: 'default', label: '已拒绝' },
    refunded: { color: 'default', label: '已退款' },
  };

  const billColumns: TableColumnsType<BillInfo> = [
    {
      title: '账期',
      key: 'period',
      render: (_, r) =>
        `${new Date(r.billing_period_start).toLocaleDateString('zh-CN')} ~ ${new Date(r.billing_period_end).toLocaleDateString('zh-CN')}`,
    },
    { title: '基础费', dataIndex: 'amount', key: 'amount', render: (v) => `¥${v.toFixed(2)}` },
    {
      title: '总金额',
      dataIndex: 'total_amount',
      key: 'total_amount',
      render: (v) => `¥${v.toFixed(2)}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => (
        <Tag color={billStatusConfig[s]?.color}>{billStatusConfig[s]?.label || s}</Tag>
      ),
    },
    {
      title: '支付时间',
      dataIndex: 'paid_at',
      key: 'paid_at',
      render: (v) => (v ? new Date(v).toLocaleString('zh-CN') : '-'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, r) => (
        <Space>
          {r.status === 'pending' && (
            <>
              <Button size="small" type="primary" onClick={() => handleApproveBill(r.bill_id)}>
                审核通过
              </Button>
              <Button size="small" danger onClick={() => handleRejectBill(r.bill_id)}>
                拒绝
              </Button>
            </>
          )}
          {r.status === 'paid' && (
            <Button
              size="small"
              onClick={() => {
                setRefundBillId(r.bill_id);
                setRefundModalOpen(true);
              }}
            >
              退款
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const tabItems: TabsProps['items'] = [
    {
      key: 'overview',
      label: '概览',
      children: (
        <div className="space-y-4">
          <TenantDetailCard
            tenant={tenant}
            onStatusChange={handleStatusChange}
            onResetApiKey={handleResetApiKey}
            onAdjustQuota={() => setSubscriptionModalOpen(true)}
            onAssignPlan={() => setPlanModalOpen(true)}
          />
        </div>
      ),
    },
    {
      key: 'subscription',
      label: '订阅信息',
      children: subscription ? (
        <Card title="当前订阅">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Text type="secondary">套餐类型</Text>
              <div className="mt-1">
                <Tag color="blue">{subscription.plan_type}</Tag>
              </div>
            </div>
            <div>
              <Text type="secondary">状态</Text>
              <div className="mt-1">
                <Tag color={subscription.status === 'active' ? 'green' : 'default'}>
                  {subscription.status === 'active' ? '有效' : subscription.status}
                </Tag>
              </div>
            </div>
            <div>
              <Text type="secondary">开始日期</Text>
              <div className="mt-1">{new Date(subscription.start_date).toLocaleDateString('zh-CN')}</div>
            </div>
            <div>
              <Text type="secondary">到期日期</Text>
              <div className="mt-1">{new Date(subscription.end_date).toLocaleDateString('zh-CN')}</div>
            </div>
            <div>
              <Text type="secondary">自动续费</Text>
              <div className="mt-1">
                <Tag color={subscription.auto_renew ? 'green' : 'default'}>
                  {subscription.auto_renew ? '已开启' : '已关闭'}
                </Tag>
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="text-center py-8">
            <Text type="secondary">暂无订阅信息</Text>
          </div>
        </Card>
      ),
    },
    {
      key: 'bills',
      label: '账单记录',
      children: (
        <div className="space-y-4">
          {!billsData && !billsLoading && (
            <Button type="primary" onClick={() => fetchBillsData(1)}>
              加载账单
            </Button>
          )}
          <Table
            dataSource={billsData?.items ?? []}
            columns={billColumns}
            rowKey="bill_id"
            loading={billsLoading}
            pagination={{
              current: billsPage,
              total: billsData?.total ?? 0,
              pageSize: 10,
              onChange: (page) => {
                setBillsPage(page);
                fetchBillsData(page);
              },
            }}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push('/tenants')}
        >
          返回
        </Button>
        <Title level={4} className="mb-0">{tenant.company_name}</Title>
      </div>

      <Tabs items={tabItems} />

      <SubscriptionManagementForm
        tenantId={tenantId}
        subscription={subscription ?? undefined}
        open={subscriptionModalOpen}
        onClose={() => setSubscriptionModalOpen(false)}
        onSuccess={fetchTenantData}
      />

      <Modal
        title="变更套餐"
        open={planModalOpen}
        onOk={handleAssignPlan}
        onCancel={() => setPlanModalOpen(false)}
        okText="确认变更"
        cancelText="取消"
      >
        <Form form={planForm} layout="vertical" initialValues={{ duration_months: 1 }}>
          <Form.Item
            name="plan_type"
            label="套餐类型"
            rules={[{ required: true, message: '请选择套餐' }]}
          >
            <Select
              options={[
                { value: 'free', label: '免费版' },
                { value: 'basic', label: '基础版' },
                { value: 'professional', label: '专业版' },
                { value: 'enterprise', label: '企业版' },
              ]}
              placeholder="请选择套餐"
            />
          </Form.Item>
          <Form.Item
            name="duration_months"
            label="订阅时长（月）"
            rules={[{ required: true, message: '请输入订阅时长' }]}
          >
            <InputNumber min={1} max={36} className="w-full" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="申请退款"
        open={refundModalOpen}
        onOk={handleRefund}
        onCancel={() => {
          setRefundModalOpen(false);
          refundForm.resetFields();
          setRefundBillId(null);
        }}
        okText="确认退款"
        cancelText="取消"
      >
        <Form form={refundForm} layout="vertical">
          <Form.Item
            name="reason"
            label="退款原因"
            rules={[{ required: true, message: '请输入退款原因' }]}
          >
            <Input.TextArea rows={3} placeholder="请输入退款原因" />
          </Form.Item>
          <Form.Item name="amount" label="退款金额（留空则全额退款）">
            <InputNumber min={0} precision={2} prefix="¥" className="w-full" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}


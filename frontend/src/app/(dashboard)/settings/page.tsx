'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Row, Col, Card, Typography, message, Alert, Form, Input, Button, Modal, Tabs } from 'antd';
import Skeleton from '@/components/ui/Loading/Skeleton';
import { SettingsMenu, SubscriptionPanel, ChangePasswordForm } from '@/components/settings';
import { CopyOutlined, KeyOutlined, ExclamationCircleOutlined, PlusOutlined, EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/store';
import { platformApi, PlatformConfig } from '@/lib/api/platform';
import { settingsApi } from '@/lib/api/settings';
import { subscriptionApi } from '@/lib/api/subscription';
import PlatformConfigCard from '@/components/settings/PlatformConfigCard';
import PlatformConfigModal from '@/components/settings/PlatformConfigModal';
import PlatformManager from '@/components/settings/PlatformManager';

const { Title, Text } = Typography;

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const [selectedMenu, setSelectedMenu] = useState('api');
  const { tenantId } = useAuthStore();
  const [planName, setPlanName] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [apiKeyLoading, setApiKeyLoading] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [platformConfigs, setPlatformConfigs] = useState<PlatformConfig[]>([]);
  const [pddLoading, setPddLoading] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState('pinduoduo');
  const [editingConfig, setEditingConfig] = useState<PlatformConfig | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Handle URL params (e.g. after OAuth callback)
  useEffect(() => {
    const menu = searchParams.get('menu');
    const status = searchParams.get('status');
    if (menu) setSelectedMenu(menu);
    if (status === 'success') message.success('拼多多授权成功！');
    if (status === 'error') message.error('授权失败，请重试');
  }, [searchParams]);

  useEffect(() => {
    if (selectedMenu === 'tenant') {
      subscriptionApi.getStatus().then((res) => {
        if (res.success && res.data) setPlanName(res.data.plan_name);
      });
    }
  }, [selectedMenu]);

  useEffect(() => {
    if (selectedMenu === 'platform') {
      loadPlatformConfigs();
    }
  }, [selectedMenu]);

  const loadPlatformConfigs = async () => {
    setPddLoading(true);
    try {
      const res = await platformApi.getConfigs();
      if (res.success && res.data) {
        setPlatformConfigs(res.data);
      }
    } finally {
      setPddLoading(false);
    }
  };

  useEffect(() => {
    if (selectedMenu === 'api') {
      settingsApi.getApiKey().then((res) => {
        if (res.success && res.data) {
          setApiKey(res.data.api_key);
        }
      }).catch(() => {});
    }
  }, [selectedMenu]);

  const handleResetApiKey = async () => {
    setApiKeyLoading(true);
    setResetConfirmOpen(false);
    try {
      const res = await settingsApi.resetApiKey();
      if (res.success && res.data) {
        setApiKey(res.data.api_key);
        message.success('API Key 已重置');
      } else {
        message.error('重置失败，请重试');
      }
    } catch {
      message.error('重置失败，请重试');
    } finally {
      setApiKeyLoading(false);
    }
  };

  const maskedApiKey = apiKey
    ? '•'.repeat(apiKey.length)
    : '（不可用，请重置获取新 Key）';

  const renderContent = () => {
    switch (selectedMenu) {
      case 'api':
        return (
          <>
            <Card>
              <Title level={5} className="mb-4">API 密钥管理</Title>
              <Alert
                message="API 密钥用于外部系统接入"
                description="您可以使用此 API 密钥将智能客服集成到您的应用中。请妥善保管，不要泄露给他人。"
                type="info"
                showIcon
                className="mb-6"
              />
              <div className="bg-gray-100 p-4 rounded-lg">
                <Text type="secondary" className="block mb-2">租户 ID:</Text>
                <div className="flex items-center gap-2 mb-4">
                  <Input
                    value={tenantId || ''}
                    readOnly
                    style={{ flex: 1, fontFamily: 'monospace' }}
                  />
                  <Button
                    icon={<CopyOutlined />}
                    onClick={() => {
                      if (tenantId) {
                        navigator.clipboard.writeText(tenantId);
                        message.success('已复制到剪贴板');
                      }
                    }}
                  >
                    复制
                  </Button>
                </div>
                <Text type="secondary" className="block mb-2">API Key:</Text>
                <div className="flex items-center gap-2">
                  <Input
                    value={apiKeyVisible ? (apiKey || '') : maskedApiKey}
                    readOnly
                    style={{ flex: 1, fontFamily: 'monospace' }}
                    prefix={<KeyOutlined />}
                    suffix={
                      apiKey ? (
                        <span
                          className="cursor-pointer text-gray-400 hover:text-gray-600"
                          onClick={() => setApiKeyVisible(!apiKeyVisible)}
                        >
                          {apiKeyVisible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                        </span>
                      ) : null
                    }
                  />
                  <Button
                    icon={<CopyOutlined />}
                    disabled={!apiKey}
                    onClick={() => {
                      if (apiKey) {
                        navigator.clipboard.writeText(apiKey);
                        message.success('已复制到剪贴板');
                      }
                    }}
                  >
                    复制
                  </Button>
                  <Button
                    danger
                    loading={apiKeyLoading}
                    onClick={() => setResetConfirmOpen(true)}
                  >
                    重置
                  </Button>
                </div>
              </div>
              <Alert
                message="认证方式"
                description="外部 API 请求在 Header 中添加 X-API-Key: {api_key}；Dashboard 使用 Authorization: Bearer {access_token}"
                type="info"
                showIcon
                className="mt-4"
              />
            </Card>

            {/* 确认重置弹窗 */}
            <Modal
              title={<span><ExclamationCircleOutlined className="text-yellow-500 mr-2" />确认重置 API Key</span>}
              open={resetConfirmOpen}
              onOk={handleResetApiKey}
              onCancel={() => setResetConfirmOpen(false)}
              okText="确认重置"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <p>重置后，旧的 API Key 将<strong>立即失效</strong>，所有使用旧 Key 的集成需要同步更新。</p>
              <p>确认继续？</p>
            </Modal>
          </>
        );
      case 'tenant':
        return (
          <Card>
            <Title level={5} className="mb-4">租户信息</Title>
            <Form layout="vertical">
              <Form.Item label="租户 ID">
                <Input value={tenantId || ''} disabled />
              </Form.Item>
              <Form.Item label="当前套餐">
                <Input value={planName ?? '加载中...'} disabled />
              </Form.Item>
              <Alert
                message="如需修改租户信息，请联系管理员"
                type="info"
                showIcon
              />
            </Form>
          </Card>
        );
      case 'notification':
        return (
          <Card>
            <Title level={5} className="mb-4">通知设置</Title>
            <Alert
              message="通知功能即将上线"
              description="我们正在开发通知功能，包括邮件通知、短信通知和 Webhook 回调等。敬请期待！"
              type="info"
              showIcon
            />
          </Card>
        );
      case 'password':
        return <ChangePasswordForm />;
      case 'subscription':
        return <SubscriptionPanel />;
      case 'platform': {
        const pddConfigs = platformConfigs.filter(c => c.platform_type === 'pinduoduo');
        const douyinConfigs = platformConfigs.filter(c => c.platform_type === 'douyin');

        return (
          <>
            {/* ISV 模式：五大平台统一管理 */}
            <PlatformManager />

            <div className="mt-8">
              <Title level={5} className="mb-4">手动配置（兼容模式）</Title>
            </div>

            <Tabs
              activeKey={selectedPlatform}
              onChange={setSelectedPlatform}
              items={[
                { key: 'pinduoduo', label: '拼多多' },
                { key: 'douyin', label: '抖音抖店' },
              ]}
            />

            {pddLoading ? (
              <div className="space-y-3 py-4">
                {[0, 1].map((i) => (
                  <div key={i} className="bg-white rounded-lg border border-neutral-200 p-4">
                    <Skeleton variant="text" width="30%" />
                    <Skeleton variant="text" width="50%" className="mt-2" />
                    <Skeleton variant="rectangular" height={32} width="20%" className="mt-3" />
                  </div>
                ))}
              </div>
            ) : (
            <div className="animate-fade-in">
              {selectedPlatform === 'pinduoduo' && (
                <div>
                  {pddConfigs.map(config => (
                    <Card key={config.id} className="mb-4">
                      <PlatformConfigCard
                        config={config}
                        onEdit={() => setEditingConfig(config)}
                        onDelete={async () => {
                          Modal.confirm({
                            title: '确认删除',
                            content: '删除后将断开与该店铺的连接，确认继续？',
                            okText: '确认',
                            cancelText: '取消',
                            onOk: async () => {
                              try {
                                await platformApi.disconnect(config.id);
                                message.success('已删除');
                                loadPlatformConfigs();
                              } catch {
                                message.error('删除失败');
                              }
                            },
                          });
                        }}
                        onConnect={() => {
                          const redirectUri = `${window.location.origin}/api/v1/platform/pinduoduo/callback`;
                          window.location.href = platformApi.getAuthUrl(config.id, redirectUri);
                        }}
                      />
                    </Card>
                  ))}

                  <Button
                    type="dashed"
                    block
                    icon={<PlusOutlined />}
                    onClick={() => setShowAddModal(true)}
                  >
                    添加拼多多店铺
                  </Button>
                </div>
              )}

              {selectedPlatform === 'douyin' && (
                <div>
                  {douyinConfigs.map(config => (
                    <Card key={config.id} className="mb-4">
                      <PlatformConfigCard
                        config={config}
                        onEdit={() => setEditingConfig(config)}
                        onDelete={async () => {
                          Modal.confirm({
                            title: '确认删除',
                            content: '删除后将断开与该店铺的连接，确认继续？',
                            okText: '确认',
                            cancelText: '取消',
                            onOk: async () => {
                              try {
                                await platformApi.disconnect(config.id);
                                message.success('已删除');
                                loadPlatformConfigs();
                              } catch {
                                message.error('删除失败');
                              }
                            },
                          });
                        }}
                        onConnect={() => {
                          const redirectUri = `${window.location.origin}/api/v1/platform/douyin/callback`;
                          window.location.href = platformApi.getDouyinAuthUrl(config.id, redirectUri);
                        }}
                      />
                    </Card>
                  ))}

                  <Button
                    type="dashed"
                    block
                    icon={<PlusOutlined />}
                    onClick={() => {
                      setSelectedPlatform('douyin');
                      setShowAddModal(true);
                    }}
                  >
                    添加抖音店铺
                  </Button>
                </div>
              )}
            </div>
            )}

            <PlatformConfigModal
              visible={showAddModal || !!editingConfig}
              config={editingConfig}
              platform={selectedPlatform}
              onClose={() => {
                setShowAddModal(false);
                setEditingConfig(null);
              }}
              onSuccess={() => {
                loadPlatformConfigs();
                setShowAddModal(false);
                setEditingConfig(null);
              }}
            />
          </>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div>
      <Title level={4} className="mb-6">系统设置</Title>
      <Row gutter={24}>
        <Col xs={24} md={6}>
          <SettingsMenu selectedKey={selectedMenu} onSelect={setSelectedMenu} />
        </Col>
        <Col xs={24} md={18}>
          {renderContent()}
        </Col>
      </Row>
    </div>
  );
}

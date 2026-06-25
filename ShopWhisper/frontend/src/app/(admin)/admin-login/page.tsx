'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Form, Input, Button, Typography, Alert } from 'antd';
import { UserOutlined, LockOutlined, SettingOutlined } from '@ant-design/icons';
import { useAdminStore } from '@/store';
import { AdminLoginRequest } from '@/types/admin';
import { AuthLayout } from '@/components/layout';

const { Text } = Typography;

export default function AdminLoginPage() {
  const router = useRouter();
  const { login, isLoading, error, clearError, isAuthenticated, checkAdminAuth } = useAdminStore();
  const [form] = Form.useForm();

  useEffect(() => {
    if (checkAdminAuth() && isAuthenticated) {
      router.push('/platform');
    }
  }, [checkAdminAuth, isAuthenticated, router]);

  const handleSubmit = async (values: AdminLoginRequest) => {
    clearError();
    const success = await login(values);
    if (success) {
      router.push('/platform');
    }
  };

  return (
    <AuthLayout
      title="平台管理后台"
      subtitle="电商智能客服管理系统"
      icon={<SettingOutlined className="text-2xl text-white" />}
    >
      {error && (
        <Alert
          message={error}
          type="error"
          showIcon
          closable
          onClose={clearError}
          className="mb-4"
        />
      )}

      <Form
        form={form}
        name="admin_login"
        onFinish={handleSubmit}
        size="large"
        layout="vertical"
      >
        <Form.Item
          name="username"
          rules={[{ required: true, message: '请输入用户名' }]}
        >
          <Input
            prefix={<UserOutlined className="text-neutral-400" />}
            placeholder="用户名"
            autoComplete="username"
          />
        </Form.Item>

        <Form.Item
          name="password"
          rules={[{ required: true, message: '请输入密码' }]}
        >
          <Input.Password
            prefix={<LockOutlined className="text-neutral-400" />}
            placeholder="密码"
            autoComplete="current-password"
          />
        </Form.Item>

        <Form.Item className="mb-0">
          <Button
            type="primary"
            htmlType="submit"
            loading={isLoading}
            block
            size="large"
            className="!rounded-lg !h-11 !font-semibold"
          >
            登录
          </Button>
        </Form.Item>
      </Form>

      <div className="mt-6 text-center">
        <Text type="secondary" className="text-xs">
          仅限平台管理员登录
        </Text>
      </div>
    </AuthLayout>
  );
}

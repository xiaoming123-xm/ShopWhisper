'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Form, Input, Button, Checkbox, Typography, message } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/store';
import { AuthLayout } from '@/components/layout';

const { Text } = Typography;

interface LoginFormValues {
  email: string;
  password: string;
  remember: boolean;
}

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, error, clearError, isAuthenticated } = useAuthStore();
  const [form] = Form.useForm();

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (error) {
      message.error(error);
      clearError();
    }
  }, [error, clearError]);

  const onFinish = async (values: LoginFormValues) => {
    const success = await login({
      email: values.email,
      password: values.password,
    });

    if (success) {
      message.success('登录成功');
      router.push('/dashboard');
    }
  };

  return (
    <AuthLayout title="电商智能客服平台" subtitle="SaaS 租户管理系统">
      <Form
        form={form}
        name="login"
        onFinish={onFinish}
        autoComplete="off"
        layout="vertical"
        initialValues={{ remember: true }}
      >
        <Form.Item
          name="email"
          label="电子邮箱"
          rules={[
            { required: true, message: '请输入邮箱' },
            { type: 'email', message: '请输入有效的邮箱地址' },
          ]}
        >
          <Input
            prefix={<MailOutlined className="text-neutral-400" />}
            placeholder="admin@example.com"
            size="large"
            className="rounded-lg"
          />
        </Form.Item>

        <Form.Item
          name="password"
          label="密码"
          rules={[{ required: true, message: '请输入密码' }]}
        >
          <Input.Password
            prefix={<LockOutlined className="text-neutral-400" />}
            placeholder="请输入密码"
            size="large"
            className="rounded-lg"
          />
        </Form.Item>

        <Form.Item>
          <div className="flex justify-between items-center">
            <Form.Item name="remember" valuePropName="checked" noStyle>
              <Checkbox>记住我</Checkbox>
            </Form.Item>
            <Link href="#" className="text-sm text-brand-500 hover:text-brand-600">
              忘记密码?
            </Link>
          </div>
        </Form.Item>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            size="large"
            block
            loading={isLoading}
            className="!rounded-lg !h-11 !font-semibold"
          >
            登录
          </Button>
        </Form.Item>

        <div className="text-center">
          <Text type="secondary" className="text-sm">
            还没有账号?{' '}
            <Link href="/register" className="text-brand-500 hover:text-brand-600 font-medium">
              立即注册试用
            </Link>
          </Text>
        </div>
      </Form>
    </AuthLayout>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Form, Input, Button, Typography, message, Modal, Alert } from 'antd';
import {
  MailOutlined,
  LockOutlined,
  UserOutlined,
  PhoneOutlined,
  BankOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '@/store';
import { AuthLayout } from '@/components/layout';

const { Text } = Typography;

interface RegisterFormValues {
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone?: string;
  password: string;
  confirm_password: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const { register, isLoading, error, clearError } = useAuthStore();
  const [form] = Form.useForm();
  const [apiKeyModal, setApiKeyModal] = useState(false);
  const [apiKey, setApiKey] = useState('');

  const onFinish = async (values: RegisterFormValues) => {
    clearError();

    const result = await register({
      company_name: values.company_name,
      contact_name: values.contact_name,
      contact_email: values.contact_email,
      contact_phone: values.contact_phone,
      password: values.password,
    });

    if (result.success && result.apiKey) {
      setApiKey(result.apiKey);
      setApiKeyModal(true);
    } else if (error) {
      message.error(error);
    }
  };

  const handleModalClose = () => {
    setApiKeyModal(false);
    message.success('注册成功，请登录');
    router.push('/login');
  };

  return (
    <AuthLayout title="注册新账户" subtitle="开始使用智能客服平台">
      <Form
        form={form}
        name="register"
        onFinish={onFinish}
        autoComplete="off"
        layout="vertical"
      >
        <Form.Item
          name="company_name"
          label="公司名称"
          rules={[
            { required: true, message: '请输入公司名称' },
            { max: 256, message: '公司名称不超过256个字符' },
          ]}
        >
          <Input
            prefix={<BankOutlined className="text-neutral-400" />}
            placeholder="请输入公司名称"
            size="large"
          />
        </Form.Item>

        <Form.Item
          name="contact_name"
          label="联系人姓名"
          rules={[
            { required: true, message: '请输入联系人姓名' },
            { max: 128, message: '联系人姓名不超过128个字符' },
          ]}
        >
          <Input
            prefix={<UserOutlined className="text-neutral-400" />}
            placeholder="请输入联系人姓名"
            size="large"
          />
        </Form.Item>

        <Form.Item
          name="contact_email"
          label="联系邮箱"
          rules={[
            { required: true, message: '请输入邮箱' },
            { type: 'email', message: '请输入有效的邮箱地址' },
          ]}
        >
          <Input
            prefix={<MailOutlined className="text-neutral-400" />}
            placeholder="请输入联系邮箱"
            size="large"
          />
        </Form.Item>

        <Form.Item name="contact_phone" label="联系电话" rules={[
          {
            pattern: /^1[3-9]\d{9}$/,
            message: '请输入有效的手机号码',
          },
        ]}>
          <Input
            prefix={<PhoneOutlined className="text-neutral-400" />}
            placeholder="请输入联系电话（选填）"
            size="large"
          />
        </Form.Item>

        <Form.Item
          name="password"
          label="密码"
          rules={[
            { required: true, message: '请输入密码' },
            { min: 8, message: '密码长度至少为8位' },
            {
              validator(_, value) {
                if (!value) return Promise.resolve();
                const hasUpper = /[A-Z]/.test(value);
                const hasLower = /[a-z]/.test(value);
                const hasNumber = /\d/.test(value);
                if (hasUpper && hasLower && hasNumber) return Promise.resolve();
                return Promise.reject(new Error('密码须包含大写字母、小写字母和数字'));
              },
            },
          ]}
        >
          <Input.Password
            prefix={<LockOutlined className="text-neutral-400" />}
            placeholder="请输入密码（至少8位）"
            size="large"
          />
        </Form.Item>

        <Form.Item
          name="confirm_password"
          label="确认密码"
          dependencies={['password']}
          rules={[
            { required: true, message: '请确认密码' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('两次输入的密码不一致'));
              },
            }),
          ]}
        >
          <Input.Password
            prefix={<LockOutlined className="text-neutral-400" />}
            placeholder="请再次输入密码"
            size="large"
          />
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
            注册
          </Button>
        </Form.Item>

        <div className="text-center">
          <Text type="secondary">
            已有账号?{' '}
            <Link href="/login" className="text-brand-500 hover:text-brand-600 font-medium">
              立即登录
            </Link>
          </Text>
        </div>
      </Form>

      <Modal
        title="注册成功"
        open={apiKeyModal}
        onOk={handleModalClose}
        onCancel={handleModalClose}
        okText="前往登录"
        cancelButtonProps={{ style: { display: 'none' } }}
      >
        <Alert
          message="请妥善保存您的 API Key"
          description="API Key 仅显示一次，请立即复制保存。"
          type="warning"
          showIcon
          className="mb-4"
        />
        <div className="bg-neutral-100 p-3 rounded flex items-center justify-between">
          <Typography.Paragraph copyable={{ text: apiKey }} className="mb-0 font-mono text-sm break-all">
            {apiKey}
          </Typography.Paragraph>
        </div>
      </Modal>
    </AuthLayout>
  );
}

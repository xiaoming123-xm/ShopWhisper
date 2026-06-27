'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Form, Input, Button, Typography, message } from 'antd';
import { authApi } from '@/lib/api/auth';
import { useAuthStore } from '@/store';

const { Title } = Typography;

interface ChangePasswordFormValues {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export default function ChangePasswordForm() {
  const [form] = Form.useForm<ChangePasswordFormValues>();
  const [loading, setLoading] = useState(false);
  const { logout } = useAuthStore();
  const router = useRouter();

  const handleSubmit = async (values: ChangePasswordFormValues) => {
    setLoading(true);
    try {
      const res = await authApi.changePassword(values);
      if (res.success) {
        message.success('密码修改成功，即将跳转到登录页');
        form.resetFields();
        setTimeout(async () => {
          await logout();
          router.push('/login');
        }, 1500);
      } else {
        message.error(res.error?.message || '修改失败');
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      message.error(error.response?.data?.error?.message || '修改失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <Title level={5} className="mb-4">修改密码</Title>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        style={{ maxWidth: 400 }}
      >
        <Form.Item
          name="current_password"
          label="当前密码"
          rules={[{ required: true, message: '请输入当前密码' }]}
        >
          <Input.Password placeholder="请输入当前密码" />
        </Form.Item>

        <Form.Item
          name="new_password"
          label="新密码"
          rules={[
            { required: true, message: '请输入新密码' },
            { min: 8, message: '密码至少 8 个字符' },
            {
              pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
              message: '密码须包含大写字母、小写字母和数字',
            },
          ]}
        >
          <Input.Password placeholder="请输入新密码" />
        </Form.Item>

        <Form.Item
          name="confirm_password"
          label="确认新密码"
          dependencies={['new_password']}
          rules={[
            { required: true, message: '请确认新密码' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('new_password') === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('两次输入的密码不一致'));
              },
            }),
          ]}
        >
          <Input.Password placeholder="请再次输入新密码" />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            确认修改
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
}

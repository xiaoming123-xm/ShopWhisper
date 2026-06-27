'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal, Form, Input, message } from 'antd';
import { adminAuthApi } from '@/lib/api/admin';
import { useAdminStore } from '@/store';

interface AdminChangePasswordModalProps {
  open: boolean;
  onClose: () => void;
}

interface ChangePasswordFormValues {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export default function AdminChangePasswordModal({
  open,
  onClose,
}: AdminChangePasswordModalProps) {
  const [form] = Form.useForm<ChangePasswordFormValues>();
  const [loading, setLoading] = useState(false);
  const { logout } = useAdminStore();
  const router = useRouter();

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      const res = await adminAuthApi.changePassword(values);
      if (res.success) {
        message.success('密码修改成功，即将跳转到登录页');
        form.resetFields();
        onClose();
        setTimeout(() => {
          logout();
          router.push('/admin-login');
        }, 1500);
      } else {
        message.error(res.error?.message || '修改失败');
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      if (error.response?.data?.error?.message) {
        message.error(error.response.data.error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title="修改密码"
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      confirmLoading={loading}
      okText="确认修改"
      cancelText="取消"
      destroyOnClose
    >
      <Form form={form} layout="vertical" className="mt-4">
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
      </Form>
    </Modal>
  );
}

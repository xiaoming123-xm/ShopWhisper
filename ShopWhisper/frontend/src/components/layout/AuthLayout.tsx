'use client';

import { Card, Typography } from 'antd';
import { ShoppingCartOutlined } from '@ant-design/icons';
import { ReactNode } from 'react';

const { Title, Text } = Typography;

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle: string;
  icon?: ReactNode;
}

export default function AuthLayout({ children, title, subtitle, icon }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 bg-gradient-to-br from-brand-950 via-brand-900 to-brand-600">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-20 bg-[radial-gradient(circle,var(--brand-400),transparent)]" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full opacity-20 bg-[radial-gradient(circle,var(--brand-500),transparent)]" />
      </div>

      <Card
        className="w-full max-w-md relative rounded-2xl border-none"
        style={{ boxShadow: '0 25px 50px rgba(0,0,0,0.3)' }}
        styles={{ body: { padding: '40px 36px' } }}
      >
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-gradient-to-br from-brand-500 to-brand-400">
            {icon || (
              <ShoppingCartOutlined className="text-2xl text-white" />
            )}
          </div>
          <Title level={3} className="!mb-1 !font-bold !text-brand-950">
            {title}
          </Title>
          <Text type="secondary" className="text-sm">
            {subtitle}
          </Text>
        </div>

        {children}
      </Card>
    </div>
  );
}

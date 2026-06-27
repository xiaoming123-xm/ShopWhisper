'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Layout, Breadcrumb, Badge, Dropdown, Button } from 'antd';
import type { MenuProps } from 'antd';
import { BellOutlined, HomeOutlined, MenuOutlined, SunOutlined, MoonOutlined, UserOutlined, LockOutlined, LogoutOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useUIStore, useAdminStore } from '@/store';
import AdminChangePasswordModal from '../AdminChangePasswordModal';

const { Header: AntHeader } = Layout;

const pathNames: Record<string, string> = {
  platform: '平台概览',
  tenants: '租户管理',
  overdue: '欠费租户',
  subscriptions: '订阅管理',
  payments: '支付管理',
  bills: '账单管理',
  statistics: '数据统计',
  revenue: '收入统计',
  usage: '用量分析',
  audit: '审计监控',
  security: '安全审计',
  admins: '管理员管理',
};

export default function AdminHeader() {
  const pathname = usePathname();
  const { setMobileSidebarOpen } = useUIStore();
  const { theme, setTheme } = useTheme();
  const { admin, logout } = useAdminStore();
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const pathParts = pathname.split('/').filter(Boolean);

  const breadcrumbItems = [
    {
      title: (
        <Link href="/platform">
          <HomeOutlined className="mr-1" />
          首页
        </Link>
      ),
    },
    ...pathParts.map((part, index) => {
      // Skip tenant ID parts (UUIDs)
      if (part.includes('-') && part.length > 20) {
        return {
          title: '详情',
        };
      }
      return {
        title:
          index === pathParts.length - 1 ? (
            pathNames[part] || part
          ) : (
            <Link href={`/${pathParts.slice(0, index + 1).join('/')}`}>
              {pathNames[part] || part}
            </Link>
          ),
      };
    }),
  ];

  const notificationItems: MenuProps['items'] = [
    {
      key: '1',
      label: '暂无新通知',
      disabled: true,
    },
  ];

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'username',
      label: admin?.username || '管理员',
      disabled: true,
      style: { fontWeight: 600 },
    },
    { type: 'divider' },
    {
      key: 'change-password',
      icon: <LockOutlined />,
      label: '修改密码',
      onClick: () => setChangePasswordOpen(true),
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
      onClick: () => logout(),
    },
  ];

  return (
    <AntHeader
      className="bg-white flex items-center justify-between shadow-sm sticky top-0 z-10 px-4 h-16 leading-[64px]"
    >
      <div className="flex items-center gap-3">
        <Button
          type="text"
          icon={<MenuOutlined />}
          onClick={() => setMobileSidebarOpen(true)}
          className="md:!hidden flex items-center justify-center"
          size="large"
        />
        <Breadcrumb items={breadcrumbItems} />
      </div>

      <div className="flex items-center gap-4">
        <Button
          type="text"
          icon={theme === 'dark' ? <SunOutlined /> : <MoonOutlined />}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="text-neutral-500 hover:!text-brand-500 transition-colors"
          title={theme === 'dark' ? '切换亮色模式' : '切换暗色模式'}
        />
        <Dropdown menu={{ items: notificationItems }} placement="bottomRight">
          <Badge count={0} size="small">
            <BellOutlined className="text-lg text-neutral-500 cursor-pointer hover:text-brand-500 transition-colors" />
          </Badge>
        </Dropdown>
        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
          <Button type="text" icon={<UserOutlined />} className="text-neutral-500 hover:!text-brand-500">
            {admin?.username || '管理员'}
          </Button>
        </Dropdown>
      </div>
      <AdminChangePasswordModal
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </AntHeader>
  );
}

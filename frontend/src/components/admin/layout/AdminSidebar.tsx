'use client';

import { useEffect, useCallback, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, Avatar, Button, Tooltip, Drawer } from 'antd';
import type { MenuProps } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  CreditCardOutlined,
  DollarOutlined,
  BarChartOutlined,
  AuditOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useAdminStore, useUIStore } from '@/store';

type MenuItem = Required<MenuProps>['items'][number];

const menuItems: MenuItem[] = [
  {
    key: '/platform',
    icon: <DashboardOutlined />,
    label: '平台概览',
  },
  {
    key: '/tenants',
    icon: <TeamOutlined />,
    label: '租户管理',
    children: [
      { key: '/tenants', label: '租户列表' },
      { key: '/tenants/overdue', label: '欠费租户' },
    ],
  },
  {
    key: '/subscriptions',
    icon: <CreditCardOutlined />,
    label: '订阅管理',
  },
  {
    key: '/payments',
    icon: <DollarOutlined />,
    label: '支付管理',
    children: [
      { key: '/payments', label: '支付订单' },
      { key: '/payments/bills', label: '账单管理' },
    ],
  },
  {
    key: '/statistics',
    icon: <BarChartOutlined />,
    label: '数据统计',
    children: [
      { key: '/statistics', label: '统计概览' },
      { key: '/statistics/revenue', label: '收入统计' },
      { key: '/statistics/usage', label: '用量分析' },
    ],
  },
  {
    key: '/audit',
    icon: <AuditOutlined />,
    label: '审计监控',
    children: [
      { key: '/audit', label: '操作日志' },
      { key: '/audit/security', label: '安全审计' },
    ],
  },
  {
    key: '/admins',
    icon: <UserOutlined />,
    label: '管理员管理',
  },
];

const roleLabels: Record<string, string> = {
  super_admin: '超级管理员',
  operation_admin: '运营管理员',
  support_admin: '客服管理员',
  readonly_admin: '只读管理员',
};

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, admin } = useAdminStore();
  const { sidebarCollapsed, mobileSidebarOpen, setSidebarCollapsed, setMobileSidebarOpen } = useUIStore();
  const [isMobile, setIsMobile] = useState(false);

  // Handle responsive breakpoints
  const handleResize = useCallback(() => {
    const width = window.innerWidth;
    if (width < 768) {
      setIsMobile(true);
      setSidebarCollapsed(false);
    } else if (width < 1024) {
      setIsMobile(false);
      setSidebarCollapsed(true);
    } else {
      setIsMobile(false);
      setSidebarCollapsed(false);
    }
  }, [setSidebarCollapsed]);

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname, setMobileSidebarOpen]);

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    router.push(key);
    if (isMobile) {
      setMobileSidebarOpen(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/admin-login');
  };

  // Get selected keys based on current pathname
  const getSelectedKeys = () => {
    if (pathname.startsWith('/tenants/overdue')) return ['/tenants/overdue'];
    if (pathname.startsWith('/tenants/')) return ['/tenants'];
    if (pathname.startsWith('/payments/bills')) return ['/payments/bills'];
    if (pathname.startsWith('/statistics/revenue')) return ['/statistics/revenue'];
    if (pathname.startsWith('/statistics/usage')) return ['/statistics/usage'];
    if (pathname.startsWith('/audit/security')) return ['/audit/security'];
    return [pathname];
  };

  // Get open keys for submenu
  const getOpenKeys = () => {
    if (pathname.startsWith('/tenants')) return ['/tenants'];
    if (pathname.startsWith('/payments')) return ['/payments'];
    if (pathname.startsWith('/statistics')) return ['/statistics'];
    if (pathname.startsWith('/audit')) return ['/audit'];
    return [];
  };

  const sidebarWidth = sidebarCollapsed ? 64 : 200;

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`h-16 flex items-center ${sidebarCollapsed ? 'justify-center px-0' : 'px-6'} border-b border-neutral-700 dark:border-neutral-800`}>
        <SettingOutlined className="text-2xl flex-shrink-0" style={{ color: '#ffffff' }} />
        {!sidebarCollapsed && (
          <span className="text-white text-[1.05rem] font-semibold ml-3 tracking-tight">
            平台管理
          </span>
        )}
      </div>

      {/* Menu */}
      <div className="flex-1 py-4 overflow-y-auto">
        <Menu
          mode="inline"
          selectedKeys={getSelectedKeys()}
          defaultOpenKeys={getOpenKeys()}
          onClick={handleMenuClick}
          items={menuItems}
          theme="dark"
          inlineCollapsed={sidebarCollapsed && !isMobile}
          style={{ background: 'transparent', borderRight: 'none' }}
        />
      </div>

      {/* Admin Profile */}
      <div className="p-3">
        <div
          className={`flex items-center ${sidebarCollapsed ? 'justify-center px-1.5' : 'gap-2.5 px-3'} py-2.5 rounded-xl bg-white/[0.07] border border-white/10 hover:bg-white/10 transition-all duration-200`}
        >
          <Avatar
            size={36}
            className="flex-shrink-0 font-bold text-[0.9rem] bg-primary"
          >
            {admin?.username ? admin.username[0].toUpperCase() : <UserOutlined />}
          </Avatar>
          {!sidebarCollapsed && (
            <>
              <div className="flex-1 min-w-0">
                <span
                  className="block truncate text-[0.82rem] font-semibold leading-[1.35] tracking-[-0.01em]"
                  style={{ color: '#ffffff' }}
                >
                  {admin?.username || '管理员'}
                </span>
                <span
                  className="block truncate text-[0.7rem] leading-[1.35]"
                  style={{ color: 'rgba(255,255,255,0.65)' }}
                >
                  {admin?.role ? roleLabels[admin.role] || admin.role : ''}
                </span>
              </div>
              <Tooltip title="退出登录">
                <Button
                  type="text"
                  size="small"
                  icon={<LogoutOutlined className="text-white/50" />}
                  onClick={handleLogout}
                  className="hover:!bg-white/10 transition-colors flex-shrink-0"
                />
              </Tooltip>
            </>
          )}
        </div>
      </div>
    </div>
  );

  // Mobile: use Drawer
  if (isMobile) {
    return (
      <Drawer
        placement="left"
        open={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
        width={200}
        styles={{
          body: { padding: 0, background: 'var(--sidebar-bg)' },
          header: { display: 'none' },
        }}
        rootClassName="mobile-sidebar-drawer"
      >
        {sidebarContent}
      </Drawer>
    );
  }

  // Tablet/Desktop: fixed sidebar
  return (
    <aside
      className="fixed left-0 top-0 h-screen z-50 bg-[var(--sidebar-bg)] transition-all duration-200"
      style={{ width: sidebarWidth }}
    >
      {sidebarContent}
    </aside>
  );
}

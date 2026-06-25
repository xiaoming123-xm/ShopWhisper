'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, Avatar, Button, Tooltip, Drawer } from 'antd';
import {
  DashboardOutlined,
  MessageOutlined,
  BookOutlined,
  SettingOutlined,
  LogoutOutlined,
  ShoppingCartOutlined,
  ShoppingOutlined,
  UserOutlined,
  FileImageOutlined,
  VideoCameraOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  LineChartOutlined,
  FundOutlined,
  FormOutlined,
  SendOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  GiftOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useAuthStore, useUIStore } from '@/store';
import { settingsApi } from '@/lib/api/settings';

const menuItems = [
  {
    key: '/dashboard',
    icon: <DashboardOutlined />,
    label: '仪表盘',
  },
  {
    key: '/chat',
    icon: <MessageOutlined />,
    label: '对话管理',
  },
  {
    key: '/knowledge',
    icon: <BookOutlined />,
    label: '知识库',
  },
  {
    key: '/products',
    icon: <ShoppingOutlined />,
    label: '商品管理',
  },
  {
    key: 'content',
    icon: <FileImageOutlined />,
    label: '内容创作',
    children: [
      { key: '/content/poster', icon: <FileImageOutlined />, label: '海报生成' },
      { key: '/content/video', icon: <VideoCameraOutlined />, label: '视频生成' },
      { key: '/content/prompts', icon: <FormOutlined />, label: '提示词管理' },
      { key: '/content/assets', icon: <AppstoreOutlined />, label: '素材库' },
    ],
  },
  {
    key: 'analytics',
    icon: <BarChartOutlined />,
    label: '数据分析',
    children: [
      { key: '/analytics/orders', icon: <LineChartOutlined />, label: '订单分析' },
      { key: '/analytics/reports', icon: <FundOutlined />, label: '分析报告' },
      { key: '/analytics/dashboard', icon: <BarChartOutlined />, label: '销售看板' },
    ],
  },
  {
    key: 'outreach',
    icon: <SendOutlined />,
    label: '其他功能',
    children: [
      { key: '/outreach', icon: <SendOutlined />, label: '外呼活动' },
      { key: '/outreach/rules', icon: <ThunderboltOutlined />, label: '自动规则' },
      { key: '/outreach/segments', icon: <TeamOutlined />, label: '客户分群' },
      { key: '/outreach/follow-up', icon: <ClockCircleOutlined />, label: '定时跟进' },
      { key: '/outreach/recommendations', icon: <GiftOutlined />, label: '增购推荐' },
    ],
  },
  {
    key: '/settings',
    icon: <SettingOutlined />,
    label: '系统设置',
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, userEmail } = useAuthStore();
  const { sidebarCollapsed, mobileSidebarOpen, setSidebarCollapsed, setMobileSidebarOpen } = useUIStore();
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Handle responsive breakpoints
  const handleResize = useCallback(() => {
    const width = window.innerWidth;
    if (width < 768) {
      // Mobile: hide sidebar, show via Drawer
      setIsMobile(true);
      setSidebarCollapsed(false);
    } else if (width < 1024) {
      // Tablet: collapsed sidebar with icons only
      setIsMobile(false);
      setSidebarCollapsed(true);
    } else {
      // Desktop: full sidebar
      setIsMobile(false);
      setSidebarCollapsed(false);
    }
  }, [setSidebarCollapsed]);

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  useEffect(() => {
    settingsApi.getTenantInfo().then((res) => {
      if (res.success && res.data) setCompanyName(res.data.company_name);
    }).catch(() => {});
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname, setMobileSidebarOpen]);

  const handleMenuClick = ({ key }: { key: string }) => {
    router.push(key);
    if (isMobile) {
      setMobileSidebarOpen(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const sidebarWidth = sidebarCollapsed ? 64 : 200;

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`h-16 flex items-center ${sidebarCollapsed ? 'justify-center px-0' : 'px-6'} border-b border-neutral-700 dark:border-neutral-800`}>
        <ShoppingCartOutlined className="text-2xl flex-shrink-0" style={{ color: '#ffffff' }} />
        {!sidebarCollapsed && (
          <span className="text-white text-[1.05rem] font-semibold ml-3 tracking-tight">
            电商智能客服
          </span>
        )}
      </div>

      {/* Menu */}
      <div className="flex-1 py-4 overflow-y-auto">
        <Menu
          mode="inline"
          selectedKeys={[pathname]}
          onClick={handleMenuClick}
          items={menuItems}
          theme="dark"
          inlineCollapsed={sidebarCollapsed && !isMobile}
          style={{ background: 'transparent', borderRight: 'none' }}
        />
      </div>

      {/* User Profile */}
      <div className="p-3">
        <div
          className={`flex items-center ${sidebarCollapsed ? 'justify-center px-1.5' : 'gap-2.5 px-3'} py-2.5 rounded-xl bg-white/[0.07] border border-white/10 hover:bg-white/10 transition-all duration-200`}
        >
          <Avatar
            size={36}
            className="flex-shrink-0 font-bold text-[0.9rem] bg-primary"
          >
            {companyName ? companyName[0].toUpperCase() : <UserOutlined />}
          </Avatar>
          {!sidebarCollapsed && (
            <>
              <div className="flex-1 min-w-0">
                <span
                  className="block truncate text-[0.82rem] font-semibold leading-[1.35] tracking-[-0.01em]"
                  style={{ color: '#ffffff' }}
                >
                  {companyName || '我的平台'}
                </span>
                <span
                  className="block truncate text-[0.7rem] leading-[1.35]"
                  style={{ color: 'rgba(255,255,255,0.65)' }}
                >
                  {userEmail || ''}
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

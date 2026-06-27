'use client';

import { usePathname } from 'next/navigation';
import { Layout, Breadcrumb, Badge, Button, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { BellOutlined, HomeOutlined, MenuOutlined, SunOutlined, MoonOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useUIStore } from '@/store';

const { Header: AntHeader } = Layout;

const pathNames: Record<string, string> = {
  dashboard: '仪表盘',
  chat: '对话管理',
  knowledge: '知识库',
  settings: '系统设置',
  products: '商品管理',
  content: '内容创作',
  poster: '海报生成',
  video: '视频生成',
  prompts: '提示词管理',
  assets: '素材库',
  analytics: '数据分析',
  orders: '订单分析',
  reports: '分析报告',
  outreach: '其他功能',
  playground: 'Playground',
};

export default function Header() {
  const pathname = usePathname();
  const { setMobileSidebarOpen } = useUIStore();
  const { theme, setTheme } = useTheme();
  const pathParts = pathname.split('/').filter(Boolean);

  const breadcrumbItems = [
    {
      title: (
        <Link href="/dashboard">
          <HomeOutlined className="mr-1" />
          首页
        </Link>
      ),
    },
    ...pathParts.map((part, index) => ({
      title:
        index === pathParts.length - 1 ? (
          pathNames[part] || part
        ) : (
          <Link href={`/${pathParts.slice(0, index + 1).join('/')}`}>
            {pathNames[part] || part}
          </Link>
        ),
    })),
  ];

  const notificationItems: MenuProps['items'] = [
    {
      key: '1',
      label: '暂无新通知',
      disabled: true,
    },
  ];

  return (
    <AntHeader className="bg-white flex items-center justify-between shadow-sm sticky top-0 z-10 px-4 h-16 leading-[64px]">
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
      </div>
    </AntHeader>
  );
}

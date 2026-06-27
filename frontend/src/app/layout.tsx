import type { Metadata } from 'next';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import AntdConfigProvider from '@/components/AntdConfigProvider';
import ThemeProvider from '@/components/ThemeProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'ShopWhisper - 电商智能客服平台',
  description: '基于 AI 的电商智能客服 SaaS 平台',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AntdRegistry>
            <AntdConfigProvider>{children}</AntdConfigProvider>
          </AntdRegistry>
        </ThemeProvider>
      </body>
    </html>
  );
}

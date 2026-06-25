'use client';

import { ConfigProvider, App, theme as antTheme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { ReactNode } from 'react';
import { useTheme } from 'next-themes';
import { brandColors, functionalColors, neutralColors } from '@/styles/tokens';

const sharedToken = {
  colorPrimary: brandColors[500],
  colorSuccess: functionalColors.success[500],
  colorWarning: functionalColors.warning[500],
  colorError: functionalColors.error[500],
  colorInfo: functionalColors.info[500],
  borderRadius: 6,
  borderRadiusLG: 12,
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
};

interface AntdConfigProviderProps {
  children: ReactNode;
}

export default function AntdConfigProvider({ children }: AntdConfigProviderProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const themeConfig = {
    algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
    token: {
      ...sharedToken,
      colorBgContainer: isDark ? neutralColors[900] : '#ffffff',
      colorBgElevated: isDark ? neutralColors[800] : '#ffffff',
    },
  };

  return (
    <ConfigProvider locale={zhCN} theme={themeConfig}>
      <App>{children}</App>
    </ConfigProvider>
  );
}

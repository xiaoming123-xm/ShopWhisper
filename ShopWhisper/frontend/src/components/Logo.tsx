'use client';

import Image from 'next/image';

interface LogoProps {
  variant?: 'full' | 'icon' | 'horizontal';
  theme?: 'light' | 'dark';
  width?: number;
  height?: number;
  className?: string;
}

/**
 * ShopWhisper Logo 组件
 *
 * @param variant - Logo 变体: 'full' | 'icon' | 'horizontal'
 * @param theme - 主题: 'light' | 'dark' (仅对 horizontal 变体有效)
 * @param width - 宽度（可选，使用默认推荐尺寸）
 * @param height - 高度（可选，使用默认推荐尺寸）
 * @param className - 额外的 CSS 类名
 */
export default function Logo({
  variant = 'horizontal',
  theme = 'light',
  width,
  height,
  className = '',
}: LogoProps) {
  // 根据变体选择 logo 文件和默认尺寸
  const getLogoConfig = () => {
    switch (variant) {
      case 'full':
        return {
          src: '/logos/logo.svg',
          defaultWidth: 200,
          defaultHeight: 200,
          alt: 'ShopWhisper Logo',
        };
      case 'icon':
        return {
          src: '/logos/logo-icon.svg',
          defaultWidth: 64,
          defaultHeight: 64,
          alt: 'ShopWhisper Icon',
        };
      case 'horizontal':
      default:
        return {
          src: theme === 'dark'
            ? '/logos/logo-horizontal-dark.svg'
            : '/logos/logo-horizontal.svg',
          defaultWidth: 150,
          defaultHeight: 40,
          alt: 'ShopWhisper',
        };
    }
  };

  const config = getLogoConfig();

  return (
    <Image
      src={config.src}
      alt={config.alt}
      width={width || config.defaultWidth}
      height={height || config.defaultHeight}
      className={className}
      priority={variant === 'horizontal'} // 导航栏 logo 优先加载
    />
  );
}

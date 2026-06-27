# Logo 资源使用说明

本目录包含 ShopWhisper 项目的所有 Logo 文件。

## 📁 文件列表

| 文件名 | 说明 | 推荐用途 |
|--------|------|---------|
| `logo.svg` | 完整版 Logo (200×200px) | 启动页、关于页面、营销材料 |
| `logo-icon.svg` | 图标版 Logo (64×64px) | 应用图标、小尺寸展示 |
| `logo-horizontal.svg` | 横向版 Logo - 浅色背景 (300×80px) | 导航栏、页眉 |
| `logo-horizontal-dark.svg` | 横向版 Logo - 深色背景 (300×80px) | 深色主题导航栏 |

## 🎯 在 Next.js 中使用

### 1. 导航栏 Logo

```tsx
import Image from 'next/image'

// 浅色主题
<Image
  src="/logos/logo-horizontal.svg"
  alt="ShopWhisper"
  width={150}
  height={40}
  priority
/>

// 深色主题
<Image
  src="/logos/logo-horizontal-dark.svg"
  alt="ShopWhisper"
  width={150}
  height={40}
  priority
/>
```

### 2. 启动页/关于页面

```tsx
import Image from 'next/image'

<div className="flex justify-center">
  <Image
    src="/logos/logo.svg"
    alt="ShopWhisper Logo"
    width={200}
    height={200}
  />
</div>
```

### 3. 图标版（小尺寸）

```tsx
import Image from 'next/image'

<Image
  src="/logos/logo-icon.svg"
  alt="ShopWhisper"
  width={32}
  height={32}
/>
```

### 4. 在 HTML 中直接使用

```html
<!-- 导航栏 -->
<img src="/logos/logo-horizontal.svg" alt="ShopWhisper" height="40" />

<!-- 图标 -->
<img src="/logos/logo-icon.svg" alt="ShopWhisper" width="32" height="32" />
```

## 🔖 Favicon 配置

在 `app/layout.tsx` 或 `pages/_document.tsx` 中配置：

```tsx
// app/layout.tsx (App Router)
export const metadata = {
  title: 'ShopWhisper - 电商智能客服',
  icons: {
    icon: '/favicon.svg',
  },
}

// 或者在 HTML head 中
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
```

## 🎨 响应式使用

根据主题切换 Logo：

```tsx
'use client'

import { useTheme } from 'next-themes'
import Image from 'next/image'

export function Logo() {
  const { theme } = useTheme()

  return (
    <Image
      src={theme === 'dark'
        ? '/logos/logo-horizontal-dark.svg'
        : '/logos/logo-horizontal.svg'
      }
      alt="ShopWhisper"
      width={150}
      height={40}
      priority
    />
  )
}
```

## 📐 尺寸建议

| 使用场景 | 推荐文件 | 推荐尺寸 |
|---------|---------|---------|
| 桌面端导航栏 | logo-horizontal.svg | 高度 40-48px |
| 移动端导航栏 | logo-icon.svg | 32×32px |
| 页面标题 | logo.svg | 120-200px |
| 按钮图标 | logo-icon.svg | 24×24px |

## 🌈 配色信息

- **主色调**: #667eea → #764ba2 (紫蓝渐变)
- **强调色**: #f093fb → #f5576c (粉红渐变)
- **辅助色**: #fbbf24 (金黄色)

## 📝 注意事项

1. ✅ 所有文件都是 SVG 矢量格式，可无损缩放
2. ✅ 使用 `priority` 属性加载首屏 Logo
3. ✅ 深色主题使用 `logo-horizontal-dark.svg`
4. ✅ 保持 Logo 周围有足够的留白空间
5. ❌ 不要拉伸或变形 Logo
6. ❌ 不要修改 Logo 的配色方案

## 🔗 相关文档

- 完整设计指南：`/LOGO_GUIDE.md`
- Logo 预览页面：`/logo-preview.html`

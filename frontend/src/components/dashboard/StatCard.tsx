'use client';

import { Card, Typography } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, MinusOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  suffix?: string;
  prefix?: React.ReactNode;
  accentColor?: string;
  index?: number;
}

const accentClasses = [
  { bar: 'bg-brand-500', text: 'text-brand-500' },
  { bar: 'bg-success-500', text: 'text-success-500' },
  { bar: 'bg-warning-500', text: 'text-warning-500' },
  { bar: 'bg-error-500', text: 'text-error-500' },
  { bar: 'bg-[#8B5CF6]', text: 'text-[#8B5CF6]' },
  { bar: 'bg-info-500', text: 'text-info-500' },
];

export default function StatCard({
  title,
  value,
  change,
  suffix,
  prefix,
  accentColor,
  index = 0,
}: StatCardProps) {
  const accentClass = accentClasses[index % accentClasses.length];

  const getChangeDisplay = () => {
    if (change === undefined) return null;
    if (change === 0) {
      return { icon: <MinusOutlined />, className: 'text-neutral-500', text: '0% 较昨日' };
    }
    if (change > 0) {
      return { icon: <ArrowUpOutlined />, className: 'text-success-500', text: `+${change}% 较昨日` };
    }
    return { icon: <ArrowDownOutlined />, className: 'text-error-500', text: `${change}% 较昨日` };
  };

  const changeDisplay = getChangeDisplay();

  return (
    <Card
      className="h-full relative overflow-hidden rounded-xl border border-brand-100"
      styles={{ body: { padding: '20px 20px 16px' } }}
    >
      {/* Accent bar */}
      <div
        className={`absolute top-0 left-0 w-1 h-full rounded-l-xl ${accentColor ? '' : accentClass.bar}`}
        style={accentColor ? { background: accentColor } : undefined}
      />

      <div className="pl-1">
        <Text type="secondary" className="text-xs font-medium uppercase tracking-wide">
          {title}
        </Text>

        <div className="flex items-center gap-2 mt-2 mb-1">
          {prefix && <span className={`text-lg ${accentColor ? '' : accentClass.text}`} style={accentColor ? { color: accentColor } : undefined}>{prefix}</span>}
          <span className="text-3xl font-bold text-brand-950 leading-tight">
            {value}
          </span>
        </div>

        {changeDisplay && (
          <div className="flex items-center gap-1 mt-2">
            <span className={`text-xs font-medium ${changeDisplay.className}`}>
              {changeDisplay.icon} {changeDisplay.text}
            </span>
          </div>
        )}

        {suffix && (
          <Text type="secondary" className="text-xs block mt-1">
            {suffix}
          </Text>
        )}
      </div>
    </Card>
  );
}

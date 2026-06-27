'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, Progress, Typography, Button, Modal, Tag, Radio, message } from 'antd';
import {
  MessageOutlined,
  PictureOutlined,
  VideoCameraOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons';
import Skeleton from '@/components/ui/Loading/Skeleton';
import { subscriptionApi, QuotaUsage, AddonPack } from '@/lib/api/subscription';

const { Title, Text } = Typography;

interface QuotaItemProps {
  icon: React.ReactNode;
  label: string;
  used: number;
  quota: number;
  addonBalance?: number;
  color: string;
  onBuyAddon?: () => void;
}

function QuotaItem({ icon, label, used, quota, addonBalance = 0, color, onBuyAddon }: QuotaItemProps) {
  const total = quota + addonBalance;
  const percent = total > 0 ? Math.round((used / total) * 100) : 0;
  const status = percent >= 100 ? 'exception' : percent >= 80 ? 'active' : 'normal';

  return (
    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
      <div
        className="flex items-center justify-center w-10 h-10 rounded-lg text-white text-lg flex-shrink-0"
        style={{ backgroundColor: color }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1">
          <Text className="text-sm font-medium">{label}</Text>
          <div className="flex items-center gap-2">
            <Text className="text-xs text-gray-500">
              {used.toLocaleString()} / {total.toLocaleString()}
              {addonBalance > 0 && (
                <span className="text-purple-500 ml-1">(含加量包 {addonBalance})</span>
              )}
            </Text>
            {onBuyAddon && (
              <Button
                type="link"
                size="small"
                icon={<ShoppingCartOutlined />}
                onClick={onBuyAddon}
                className="!p-0 !h-auto text-xs"
              >
                购买加量包
              </Button>
            )}
          </div>
        </div>
        <Progress
          percent={percent}
          size="small"
          status={status}
          strokeColor={percent >= 100 ? '#ff4d4f' : percent >= 80 ? '#faad14' : color}
          showInfo={false}
        />
      </div>
    </div>
  );
}

function UnlimitedQuotaItem({ icon, label, used, color }: { icon: React.ReactNode; label: string; used: number; color: string }) {
  return (
    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
      <div
        className="flex items-center justify-center w-10 h-10 rounded-lg text-white text-lg flex-shrink-0"
        style={{ backgroundColor: color }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Text className="text-sm font-medium">{label}</Text>
            <Tag color="blue">不限量</Tag>
          </div>
          <Text className="text-xs text-gray-500">
            本月已用 {used.toLocaleString()} 次
          </Text>
        </div>
      </div>
    </div>
  );
}

export default function QuotaUsagePanel() {
  const [loading, setLoading] = useState(true);
  const [quota, setQuota] = useState<QuotaUsage | null>(null);
  const [addonModalOpen, setAddonModalOpen] = useState(false);
  const [addonPacks, setAddonPacks] = useState<AddonPack[]>([]);
  const [selectedAddon, setSelectedAddon] = useState<string>('');
  const [purchasing, setPurchasing] = useState(false);

  const fetchQuota = useCallback(() => {
    subscriptionApi
      .getQuotaUsage()
      .then((res) => {
        if (res.success && res.data) setQuota(res.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchQuota();
  }, [fetchQuota]);

  const handleOpenAddonModal = async () => {
    setAddonModalOpen(true);
    try {
      const res = await subscriptionApi.getAddonPacks();
      if (res.success && res.data) {
        setAddonPacks(res.data);
        if (res.data.length > 0) setSelectedAddon(res.data[0].addon_type);
      }
    } catch {
      message.error('获取加量包列表失败');
    }
  };

  const handlePurchase = async () => {
    if (!selectedAddon) return;
    setPurchasing(true);
    try {
      const res = await subscriptionApi.purchaseAddon({
        addon_type: selectedAddon,
        payment_channel: 'alipay',
      });
      if (res.success && res.data?.pay_url) {
        setAddonModalOpen(false);
        window.location.href = res.data.pay_url;
      } else {
        message.error('创建订单失败');
      }
    } catch {
      message.error('购买加量包失败');
    } finally {
      setPurchasing(false);
    }
  };

  const handleCloseModal = () => {
    setAddonModalOpen(false);
  };

  if (loading) {
    return (
      <Card className="mb-4">
        <Skeleton variant="text" width="30%" />
        <div className="space-y-3 mt-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rectangular" height={60} />
          ))}
        </div>
      </Card>
    );
  }

  if (!quota) return null;

  return (
    <>
      <Card className="mb-4">
        <div className="flex justify-between items-center mb-4">
          <Title level={5} className="!mb-0">
            本月配额
          </Title>
          <Text type="secondary" className="text-xs">
            {quota.billing_period}
          </Text>
        </div>
        <div className="space-y-3">
          <UnlimitedQuotaItem
            icon={<MessageOutlined />}
            label="AI 回复"
            used={quota.reply_used}
            color="#1677ff"
          />
          <QuotaItem
            icon={<PictureOutlined />}
            label="图片生成"
            used={quota.image_gen_used}
            quota={quota.image_gen_quota}
            addonBalance={quota.image_gen_addon_balance}
            color="#722ed1"
            onBuyAddon={handleOpenAddonModal}
          />
          <QuotaItem
            icon={<VideoCameraOutlined />}
            label="视频生成"
            used={quota.video_gen_used}
            quota={quota.video_gen_quota}
            addonBalance={quota.video_gen_addon_balance}
            color="#13c2c2"
            onBuyAddon={handleOpenAddonModal}
          />
        </div>
      </Card>

      <Modal
        title="购买加量包"
        open={addonModalOpen}
        onCancel={handleCloseModal}
        onOk={handlePurchase}
        okText="支付宝付款"
        okButtonProps={{ loading: purchasing, disabled: !selectedAddon }}
        cancelText="取消"
      >
        <div className="space-y-4">
          <div>
            <Text className="block mb-2 font-medium">选择加量包</Text>
            <Radio.Group
              value={selectedAddon}
              onChange={(e) => setSelectedAddon(e.target.value)}
              className="w-full"
            >
              <div className="space-y-2">
                {addonPacks.map((pack) => (
                  <Radio key={pack.addon_type} value={pack.addon_type} className="w-full">
                    <div className="inline-flex items-center gap-2">
                      <span>{pack.name}</span>
                      <Tag color="orange">¥{pack.price}</Tag>
                      <Text type="secondary" className="text-xs">
                        {pack.credits} 次
                      </Text>
                    </div>
                  </Radio>
                ))}
              </div>
            </Radio.Group>
          </div>
        </div>
      </Modal>
    </>
  );
}

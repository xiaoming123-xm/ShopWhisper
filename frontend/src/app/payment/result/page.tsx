'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button, Result, Typography } from 'antd';
import { CheckCircleOutlined, LoadingOutlined } from '@ant-design/icons';

const { Text } = Typography;

function PaymentResultContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const outTradeNo = searchParams.get('out_trade_no') || '';
  const tradeNo = searchParams.get('trade_no') || '';
  const totalAmount = searchParams.get('total_amount') || '';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-sm p-10 max-w-md w-full mx-4">
        <Result
          icon={<CheckCircleOutlined style={{ color: '#52c41a', fontSize: 64 }} />}
          title="支付完成"
          subTitle="您的订单已提交，我们正在处理中。套餐生效可能需要几分钟，请稍后刷新查看。"
          extra={[
            <Button
              key="settings"
              type="primary"
              size="large"
              onClick={() => router.push('/settings?menu=subscription')}
            >
              返回订阅管理
            </Button>,
          ]}
        />
        {outTradeNo && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-1">
            <div>
              <Text type="secondary" className="text-xs">订单号：</Text>
              <Text className="text-xs font-mono ml-1">{outTradeNo}</Text>
            </div>
            {tradeNo && (
              <div>
                <Text type="secondary" className="text-xs">支付宝单号：</Text>
                <Text className="text-xs font-mono ml-1">{tradeNo}</Text>
              </div>
            )}
            {totalAmount && (
              <div>
                <Text type="secondary" className="text-xs">支付金额：</Text>
                <Text className="text-xs ml-1">¥{totalAmount}</Text>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PaymentResultPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <LoadingOutlined style={{ fontSize: 32 }} />
        </div>
      }
    >
      <PaymentResultContent />
    </Suspense>
  );
}

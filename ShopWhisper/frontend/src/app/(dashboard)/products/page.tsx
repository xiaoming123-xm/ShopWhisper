'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Descriptions,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined, FormOutlined, ShoppingOutlined, UploadOutlined } from '@ant-design/icons';
import { productApi } from '@/lib/api/product';
import { contentApi, type ProductPrompt } from '@/lib/api/content';
import type { Product, ProductDemoListingResponse, ProductPriceEstimate } from '@/types';

const { Text, Title } = Typography;
const DEFAULT_IMAGE = '/demo/lavender-knit-sweater.png';

type LocalPhoto = { name: string; url: string; size: number };

function cacheBust(url?: string | null) {
  const safeUrl = url || DEFAULT_IMAGE;
  if (safeUrl.startsWith('/demo/')) return safeUrl;
  return `${safeUrl}${safeUrl.includes('?') ? '&' : '?'}v=${Date.now()}`;
}

export default function ProductsPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);
  const [keyword, setKeyword] = useState('');

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('服装');
  const [material, setMaterial] = useState('');
  const [color, setColor] = useState('');
  const [spec, setSpec] = useState('');
  const [cost, setCost] = useState(68);
  const [stock, setStock] = useState(36);
  const [price, setPrice] = useState<number | null>(null);
  const [promoPrompt, setPromoPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState(DEFAULT_IMAGE);
  const [previewUrl, setPreviewUrl] = useState(DEFAULT_IMAGE);
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [estimate, setEstimate] = useState<ProductPriceEstimate | null>(null);
  const [publishResult, setPublishResult] = useState<ProductDemoListingResponse | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [promptProduct, setPromptProduct] = useState<Product | null>(null);
  const [prompts, setPrompts] = useState<ProductPrompt[]>([]);
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptName, setPromptName] = useState('');
  const [promptContent, setPromptContent] = useState('');

  const handleImageChange = useCallback((url: string) => {
    setImageUrl(url);
    setPreviewUrl(cacheBust(url));
  }, []);

  const loadPhotos = useCallback(async (selectUrl?: string) => {
    const resp = await productApi.listLocalPhotos();
    if (resp.success && resp.data) {
      setPhotos(resp.data);
      if (selectUrl) {
        handleImageChange(selectUrl);
      } else if (!imageUrl || imageUrl === DEFAULT_IMAGE) {
        handleImageChange(resp.data[0]?.url || DEFAULT_IMAGE);
      }
    }
  }, [handleImageChange, imageUrl]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await productApi.listProducts({
        keyword: keyword || undefined,
        status: 'active',
        page,
        size,
      });
      if (resp.success && resp.data) {
        setProducts(resp.data.items);
        setTotal(resp.data.total);
      } else {
        message.error(resp.error?.message || '加载商品列表失败');
      }
    } catch {
      message.error('加载商品列表失败');
    } finally {
      setLoading(false);
    }
  }, [keyword, page, size]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    loadPhotos().catch(() => undefined);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUploadPhoto = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      message.warning('请上传 PNG/JPG/WebP 等图片文件');
      return;
    }

    setUploadingPhoto(true);
    try {
      const resp = await productApi.uploadLocalPhoto(file);
      if (resp.success && resp.data) {
        const uploaded = resp.data;
        setPhotos((prev) => [uploaded, ...prev.filter((item) => item.url !== uploaded.url)]);
        handleImageChange(uploaded.url);
        message.success('图片已加入商品素材，并已切换到预览');
      } else {
        message.error(resp.error?.message || '上传图片失败');
      }
    } catch {
      message.error('上传图片失败，请确认 Docker 后端和 /photo 目录可写');
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const makePayload = () => ({
    title: title.trim(),
    category,
    material: material.trim() || '混纺',
    cost,
    stock,
    target_platform: 'douyin_demo',
    image_url: imageUrl,
    color: color.trim(),
    size: spec.trim(),
  });

  const handleEstimate = async () => {
    if (!title.trim()) {
      message.warning('请先填写商品标题');
      return;
    }

    setEstimating(true);
    try {
      const resp = await productApi.estimateDemoListing(makePayload());
      if (resp.success && resp.data) {
        setEstimate(resp.data);
        setPrice(resp.data.suggested_price);
        message.success('智能标价已生成');
      } else {
        message.error(resp.error?.message || '智能标价失败');
      }
    } finally {
      setEstimating(false);
    }
  };

  const handlePublish = async () => {
    if (!title.trim()) {
      message.warning('请先填写商品标题');
      return;
    }

    setPublishing(true);
    try {
      const finalPrice = price ?? estimate?.suggested_price;
      const resp = await productApi.publishDemoListing({
        ...makePayload(),
        platform_config_id: 0,
        final_price: finalPrice,
        original_price: finalPrice ? Number((finalPrice * 1.22).toFixed(2)) : undefined,
        promo_prompt: promoPrompt.trim() || undefined,
        description: `${title.trim()}，分类：${category}，颜色：${color || '未填写'}，规格：${spec || '未填写'}。`,
      });

      if (resp.success && resp.data) {
        setPublishResult(resp.data);
        setEstimate(resp.data.estimate);
        setPrice(resp.data.product.price);
        message.success('商品已创建并上架');
        await loadProducts();
      } else {
        message.error(resp.error?.message || '上架失败');
      }
    } finally {
      setPublishing(false);
    }
  };

  const handleDeleteProduct = async (productId: number) => {
    try {
      const resp = await productApi.deleteProduct(productId);
      if (resp.success) {
        message.success('商品已下架/删除');
        await loadProducts();
      } else {
        message.error(resp.error?.message || '删除失败');
      }
    } catch {
      message.error('删除失败');
    }
  };

  const openPromptManager = async (product: Product) => {
    setPromptProduct(product);
    setPromptOpen(true);
    setPromptName('');
    setPromptContent('');
    try {
      const resp = await contentApi.listPrompts({ product_id: product.id, size: 100 });
      setPrompts(resp.success && resp.data ? resp.data.items : []);
    } catch {
      setPrompts([]);
    }
  };

  const savePrompt = async () => {
    if (!promptProduct || !promptName.trim() || !promptContent.trim()) {
      message.warning('请填写名称和广告/卖点内容');
      return;
    }

    await contentApi.createPrompt({
      product_id: promptProduct.id,
      prompt_type: 'description',
      name: promptName.trim(),
      content: promptContent.trim(),
    });
    message.success('管理提示词已添加');
    setPromptName('');
    setPromptContent('');

    const resp = await contentApi.listPrompts({ product_id: promptProduct.id, size: 100 });
    if (resp.success && resp.data) setPrompts(resp.data.items);
  };

  const columns: ColumnsType<Product> = [
    {
      title: '图片',
      dataIndex: 'images',
      width: 90,
      render: (images?: string[] | null) => {
        const src = images?.[0];
        return src ? (
          <img
            key={src}
            src={cacheBust(src)}
            width={64}
            height={64}
            style={{ objectFit: 'cover', borderRadius: 6, background: '#fafafa' }}
            alt="商品图片"
            onError={(event) => {
              event.currentTarget.src = DEFAULT_IMAGE;
            }}
          />
        ) : (
          <ShoppingOutlined style={{ fontSize: 28, color: '#999' }} />
        );
      },
    },
    { title: '商品标题', dataIndex: 'title', ellipsis: true },
    { title: '分类', dataIndex: 'category', width: 120 },
    {
      title: '价格',
      dataIndex: 'price',
      width: 120,
      render: (value: number) => <Text strong type="danger">¥{Number(value || 0).toFixed(2)}</Text>,
    },
    {
      title: '规格',
      width: 150,
      render: (_, record) => `${record.attributes?.color || '-'} / ${record.attributes?.size || '-'}`,
    },
    { title: '库存', dataIndex: 'stock', width: 90 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (status: string) => <Tag color={status === 'active' ? 'green' : 'default'}>{status === 'active' ? '在售' : status}</Tag>,
    },
    {
      title: '操作',
      width: 190,
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<FormOutlined />} onClick={() => openPromptManager(record)}>
            管理提示词
          </Button>
          <Popconfirm title="确认下架/删除这个商品吗？" onConfirm={() => handleDeleteProduct(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={4}><ShoppingOutlined /> 商品管理</Title>

      <Card title="添加商品" style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={6}>
            <img
              key={previewUrl}
              src={previewUrl}
              alt="商品预览"
              style={{ width: '100%', height: 220, objectFit: 'contain', background: '#fafafa', borderRadius: 8 }}
              onError={(event) => {
                event.currentTarget.src = DEFAULT_IMAGE;
              }}
            />
          </Col>
          <Col xs={24} md={18}>
            <Row gutter={[12, 12]}>
              <Col xs={24} md={12}>
                <Text>商品标题</Text>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：本地直销纯棉短袖" />
              </Col>
              <Col xs={12} md={6}>
                <Text>分类</Text>
                <Select
                  value={category}
                  onChange={setCategory}
                  style={{ width: '100%' }}
                  options={['服装', '电子产品', '家居用品', '美妆个护', '食品饮料', '运动户外'].map((value) => ({ value, label: value }))}
                />
              </Col>
              <Col xs={12} md={6}>
                <Text>材质</Text>
                <Input value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="棉 / 羊毛 / 合金" />
              </Col>
              <Col xs={12} md={6}>
                <Text>颜色</Text>
                <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="黑色、浅紫色" />
              </Col>
              <Col xs={12} md={6}>
                <Text>码数/规格</Text>
                <Input value={spec} onChange={(e) => setSpec(e.target.value)} placeholder="M、XL、128GB" />
              </Col>
              <Col xs={12} md={6}>
                <Text>成本价</Text>
                <InputNumber min={0} precision={2} value={cost} onChange={(v) => setCost(Number(v || 0))} addonBefore="¥" style={{ width: '100%' }} />
              </Col>
              <Col xs={12} md={6}>
                <Text>库存</Text>
                <InputNumber min={0} value={stock} onChange={(v) => setStock(Number(v || 0))} style={{ width: '100%' }} />
              </Col>
              <Col xs={12} md={6}>
                <Text>最终售价</Text>
                <InputNumber min={0} precision={2} value={price ?? undefined} onChange={(v) => setPrice(v === null ? null : Number(v))} addonBefore="¥" style={{ width: '100%' }} />
              </Col>
              <Col xs={24} md={12}>
                <Text>商品素材图片</Text>
                <Space.Compact style={{ width: '100%' }}>
                  <Select
                    value={imageUrl}
                    onChange={handleImageChange}
                    style={{ width: '100%' }}
                    options={[{ value: DEFAULT_IMAGE, label: '默认演示图片' }, ...photos.map((p) => ({ value: p.url, label: p.name }))]}
                  />
                  <Button loading={uploadingPhoto} icon={<UploadOutlined />} onClick={() => fileInputRef.current?.click()}>
                    上传
                  </Button>
                </Space.Compact>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
                  hidden
                  onChange={(event) => handleUploadPhoto(event.target.files?.[0])}
                />
              </Col>
              <Col xs={24} md={12}>
                <Text>广告卖点/管理提示词</Text>
                <Input value={promoPrompt} onChange={(e) => setPromoPrompt(e.target.value)} placeholder="例如：特价，健康，本地直销" />
              </Col>
            </Row>
            <Space wrap style={{ marginTop: 16 }}>
              <Button loading={estimating} onClick={handleEstimate}>智能标价</Button>
              <Button type="primary" loading={publishing} onClick={handlePublish}>添加商品并上架</Button>
              {estimate && <Tag color="blue">建议 ¥{estimate.suggested_price.toFixed(2)}，区间 ¥{estimate.min_price.toFixed(2)} - ¥{estimate.max_price.toFixed(2)}</Tag>}
              {publishResult && <Tag color="green">已上架，商品ID：{publishResult.product.id}</Tag>}
            </Space>
          </Col>
        </Row>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="搜索商品标题"
          allowClear
          style={{ maxWidth: 360 }}
          onSearch={(value) => {
            setKeyword(value);
            setPage(1);
          }}
        />
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={products}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize: size,
            total,
            showSizeChanger: true,
            onChange: (nextPage, nextSize) => {
              setPage(nextPage);
              setSize(nextSize);
            },
          }}
        />
      </Card>

      <Modal title={`管理提示词 - ${promptProduct?.title || ''}`} open={promptOpen} onCancel={() => setPromptOpen(false)} footer={null} width={760}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="用法">
              添加服装描述、广告词、活动卖点，例如“特价，健康，本地直销”。
            </Descriptions.Item>
          </Descriptions>
          <Space.Compact style={{ width: '100%' }}>
            <Input value={promptName} onChange={(e) => setPromptName(e.target.value)} placeholder="名称，如：夏季活动卖点" style={{ width: 220 }} />
            <Input value={promptContent} onChange={(e) => setPromptContent(e.target.value)} placeholder="内容，如：特价，健康，本地直销" />
            <Button type="primary" onClick={savePrompt}>添加</Button>
          </Space.Compact>
          <Table
            rowKey="id"
            dataSource={prompts}
            pagination={false}
            size="small"
            columns={[
              { title: '名称', dataIndex: 'name', width: 180 },
              { title: '类型', dataIndex: 'prompt_type', width: 100, render: () => <Tag color="orange">描述</Tag> },
              { title: '内容', dataIndex: 'content' },
            ]}
          />
        </Space>
      </Modal>
    </div>
  );
}

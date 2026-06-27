"""
增强的RAG服务 - 完整7步流程 + Rerank
"""
from typing import Any, List
from sqlalchemy.ext.asyncio import AsyncSession

from services.rag_service import RAGService
from services.embedding_service import EmbeddingService
from services.milvus_service import MilvusService
from services.knowledge_service import KnowledgeService
from services.llm_service import LLMService


class EnhancedRAGService:
    """
    增强的RAG检索服务

    实现完整的7步RAG流程：
    1. 权限验证
    2. 向量化
    3. 检索
    4. 重排序 (Rerank)
    5. Prompt构建
    6. LLM生成
    7. 后处理
    """

    def __init__(self, db: AsyncSession, tenant_id: str):
        self.db = db
        self.tenant_id = tenant_id
        self.rag_service = RAGService(db, tenant_id)
        self.embedding_service = EmbeddingService(tenant_id)
        self.milvus_service = MilvusService(tenant_id)
        self.knowledge_service = KnowledgeService(db, tenant_id)
        self.llm_service = LLMService(tenant_id)

    async def query_with_full_pipeline(
        self,
        query: str,
        top_k: int = 5,
        rerank_top_k: int = 3,
        use_rerank: bool = True,
    ) -> dict[str, Any]:
        """
        完整的7步RAG查询流程

        Args:
            query: 用户查询
            top_k: 初始检索数量
            rerank_top_k: Rerank后保留数量
            use_rerank: 是否使用Rerank

        Returns:
            RAG查询结果
        """
        result = {
            "query": query,
            "steps": [],
            "retrieved_docs": [],
            "response": None,
            "usage": {}
        }

        try:
            # Step 1: 权限验证
            result["steps"].append("1. 权限验证")
            await self._verify_permission()

            # Step 2: 向量化
            result["steps"].append("2. 向量化查询")
            query_vector = await self.embedding_service.embed_text(query)
            result["usage"]["query_tokens"] = len(query) // 3  # 估算Token

            # Step 3: 检索
            result["steps"].append("3. 向量检索")
            initial_results = await self.milvus_service.search_vectors(
                query_vector=query_vector,
                top_k=top_k,
                filter_expr=None
            )

            if not initial_results:
                result["steps"].append("未检索到相关文档")
                return result

            # Step 4: Rerank重排序
            if use_rerank:
                result["steps"].append("4. Rerank重排序")
                reranked_results = await self._rerank_results(query, initial_results, rerank_top_k)
            else:
                reranked_results = initial_results[:rerank_top_k]

            # 获取完整文档内容
            knowledge_ids = [r["knowledge_id"] for r in reranked_results]
            knowledge_items = await self.knowledge_service.get_knowledge_by_ids(knowledge_ids)

            # Step 5: Prompt构建
            result["steps"].append("5. Prompt构建")
            prompt = await self._build_prompt(query, knowledge_items)

            # Step 6: LLM生成
            result["steps"].append("6. LLM生成")
            from langchain_core.messages import HumanMessage, SystemMessage

            messages = [
                SystemMessage(content="你是一个专业的客服助手，请基于提供的知识库内容回答用户问题。"),
                HumanMessage(content=prompt)
            ]

            llm_response = await self.llm_service.generate_response(
                messages=messages,
                tenant_id=self.tenant_id
            )

            result["response"] = llm_response.get("content", "")
            result["usage"]["input_tokens"] = llm_response.get("input_tokens", 0)
            result["usage"]["output_tokens"] = llm_response.get("output_tokens", 0)

            # Step 7: 后处理
            result["steps"].append("7. 后处理")
            result["response"] = await self._post_process(result["response"])

            result["retrieved_docs"] = [
                {
                    "knowledge_id": k.knowledge_id,
                    "title": k.title,
                    "score": next((r["similarity"] for r in reranked_results if r["knowledge_id"] == k.knowledge_id), 0.0)
                }
                for k in knowledge_items
            ]

            return result

        except Exception as e:
            result["error"] = str(e)
            return result

    async def _rerank_results(
        self,
        query: str,
        initial_results: List[dict],
        top_k: int
    ) -> List[dict]:
        """
        Rerank重排序（基于相似度+语义相关性）

        Args:
            query: 原始查询
            initial_results: 初始检索结果
            top_k: 保留前K个结果

        Returns:
            重排序后的结果
        """
        if not initial_results:
            return []

        # 简单的Rerank策略：结合向量相似度和文本匹配度
        reranked = []

        for result in initial_results:
            # 向量相似度（已经标准化到0-1）
            vector_score = result["similarity"]

            # 文本匹配度（简单的关键词匹配）
            content = result.get("content", "")
            query_words = set(query.lower().split())
            content_words = set(content.lower().split())

            # 计算Jaccard相似度
            intersection = len(query_words & content_words)
            union = len(query_words | content_words)
            text_score = intersection / union if union > 0 else 0

            # 综合得分（60%向量相似度 + 40%文本匹配）
            combined_score = 0.6 * vector_score + 0.4 * text_score

            reranked.append({
                **result,
                "rerank_score": combined_score
            })

        # 按综合得分排序
        reranked.sort(key=lambda x: x["rerank_score"], reverse=True)

        return reranked[:top_k]

    async def _verify_permission(self) -> None:
        """Step 1: 验证租户权限"""
        # 检查租户状态
        from services.tenant_service import TenantService

        tenant_service = TenantService(self.db)
        tenant = await tenant_service.get_tenant(self.tenant_id)

        if tenant.status != "active":
            raise Exception(f"租户状态异常: {tenant.status}")

        # 检查RAG功能是否开通
        from services.subscription_service import SubscriptionService

        subscription_service = SubscriptionService(self.db)
        subscription = await subscription_service.get_subscription(self.tenant_id)

        if "knowledge_base" not in subscription.enabled_features:
            raise Exception("未开通知识库功能")

    async def _build_prompt(self, query: str, knowledge_items: List[Any]) -> str:
        """
        Step 5: 构建Prompt

        Args:
            query: 用户查询
            knowledge_items: 知识库条目

        Returns:
            构建好的Prompt
        """
        prompt_parts = [
            f"用户问题：{query}\n",
            "请基于以下知识库内容回答问题：\n"
        ]

        for item in knowledge_items:
            prompt_parts.append(f"\n【{item.title}】\n{item.content}\n")

        prompt_parts.append("\n请根据以上信息，给出准确、完整的回答。")

        return "\n".join(prompt_parts)

    async def _post_process(self, response: str) -> str:
        """
        Step 7: 后处理

        - 数据脱敏
        - 格式化
        - 长度限制
        """
        from api.content_filter import ContentFilter

        # PII数据脱敏
        filtered = ContentFilter.mask_pii_data(response)

        # 长度限制（最多2000字符）
        if len(filtered) > 2000:
            filtered = filtered[:1997] + "..."

        return filtered

    async def batch_index_with_usage(
        self,
        knowledge_ids: List[str],
        chunk_size: int = 10
    ) -> dict[str, Any]:
        """
        批量索引知识并记录Token消耗

        Args:
            knowledge_ids: 知识库ID列表
            chunk_size: 分批大小

        Returns:
            索引结果
        """
        total_tokens = 0
        success_count = 0
        failed_count = 0

        for i in range(0, len(knowledge_ids), chunk_size):
            batch = knowledge_ids[i:i+chunk_size]

            for kid in batch:
                try:
                    # 索引单个知识
                    result = await self.rag_service.index_knowledge(kid)

                    if result.get("indexed"):
                        # 估算Token消耗（简化：每1000字符约333 tokens）
                        knowledge = await self.knowledge_service.get_knowledge(kid)
                        text_length = len(knowledge.title) + len(knowledge.content)
                        tokens = text_length // 3
                        total_tokens += tokens

                        success_count += 1
                    else:
                        failed_count += 1

                except Exception as e:
                    failed_count += 1
                    print(f"索引失败: {kid}, error: {e}")

        return {
            "total": len(knowledge_ids),
            "success": success_count,
            "failed": failed_count,
            "total_tokens": total_tokens
        }

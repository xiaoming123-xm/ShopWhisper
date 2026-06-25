"""WebSocket chat routes."""

import json
from datetime import datetime

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import AuthenticationException
from core.security import decode_token, verify_api_key
from db.session import AsyncSessionLocal
from services import ConversationChainService, ConversationService, TenantService
from services.knowledge_service import KnowledgeService
from services.prompt_service import PromptService
from services.websocket_service import connection_manager

router = APIRouter(prefix="/ws", tags=["WebSocket"])


async def verify_websocket_auth(api_key: str, db: AsyncSession) -> str:
    """Accept either a tenant API key or a JWT access token."""
    try:
        tenant = await verify_api_key(db, api_key)
        if tenant and tenant.is_active:
            return tenant.tenant_id
    except Exception:
        pass

    try:
        payload = decode_token(api_key)
        tenant_id = payload.get("tenant_id") or payload.get("sub")
        if tenant_id:
            await TenantService(db).check_tenant_access(tenant_id)
            return tenant_id
    except Exception:
        pass

    raise AuthenticationException("WebSocket authentication failed")


async def _build_rag_context(
    db: AsyncSession,
    tenant_id: str,
    query: str,
    top_k: int = 3,
) -> tuple[str, list[dict]]:
    knowledge_list = await KnowledgeService(db, tenant_id).search_knowledge(
        query=query,
        top_k=top_k,
    )
    context_parts: list[str] = []
    sources: list[dict] = []
    for item in knowledge_list:
        content = item.content or ""
        context_parts.append(f"[{item.title}]\n{content[:1200]}")
        sources.append(
            {
                "knowledge_id": item.knowledge_id,
                "title": item.title,
                "content": content[:300],
                "score": 0.8,
                "source": item.source or item.title,
            }
        )
    return "\n\n".join(context_parts), sources


async def _send_metadata(
    tenant_id: str,
    conversation_id: str,
    *,
    model: str | None = None,
    input_tokens: int = 0,
    output_tokens: int = 0,
    used_rag: bool = False,
    sources: list[dict] | None = None,
    error: str | None = None,
) -> None:
    payload = {
        "type": "metadata",
        "tokens": {
            "input": input_tokens,
            "output": output_tokens,
            "total": input_tokens + output_tokens,
        },
        "model": model,
        "used_rag": used_rag,
        "sources": sources or [],
    }
    if error:
        payload["error"] = error
    await connection_manager.send_message(tenant_id, conversation_id, payload)


async def _open_chat(websocket: WebSocket, api_key: str, conversation_id: str):
    async with AsyncSessionLocal() as db:
        tenant_id = await verify_websocket_auth(api_key, db)
        await connection_manager.connect(websocket, tenant_id, conversation_id)
        chain = ConversationChainService(
            db=db,
            tenant_id=tenant_id,
            conversation_id=conversation_id,
        )
        await chain.initialize()
        return db, tenant_id, chain


@router.websocket("/chat")
async def websocket_chat_endpoint(
    websocket: WebSocket,
    api_key: str = Query(..., description="API Key or JWT token"),
    conversation_id: str = Query(..., description="Conversation ID"),
):
    tenant_id = None
    try:
        async with AsyncSessionLocal() as db:
            tenant_id = await verify_websocket_auth(api_key, db)
            await connection_manager.connect(websocket, tenant_id, conversation_id)
            chain = ConversationChainService(
                db=db,
                tenant_id=tenant_id,
                conversation_id=conversation_id,
            )
            await chain.initialize()

            while True:
                try:
                    raw = await websocket.receive_text()
                    message_data = json.loads(raw)
                    message_type = message_data.get("type", "message")

                    if message_type == "ping":
                        await connection_manager.send_message(
                            tenant_id,
                            conversation_id,
                            {"type": "pong", "timestamp": datetime.now().isoformat()},
                        )
                        continue

                    user_input = (message_data.get("content") or "").strip()
                    if not user_input:
                        await connection_manager.send_error(
                            tenant_id,
                            conversation_id,
                            "Message content cannot be empty",
                        )
                        continue

                    await handle_chat_message(
                        db=db,
                        tenant_id=tenant_id,
                        conversation_id=conversation_id,
                        user_input=user_input,
                        use_rag=bool(message_data.get("use_rag", False)),
                        chain=chain,
                    )

                except WebSocketDisconnect:
                    break
                except json.JSONDecodeError:
                    await connection_manager.send_error(
                        tenant_id,
                        conversation_id,
                        "Invalid JSON message",
                    )
                except Exception as exc:
                    await connection_manager.send_error(
                        tenant_id,
                        conversation_id,
                        f"Message handling failed: {exc}",
                    )

    except AuthenticationException as exc:
        await websocket.close(code=1008, reason=str(exc))
    except Exception:
        await websocket.close(code=1011, reason="Internal server error")
    finally:
        if tenant_id:
            connection_manager.disconnect(tenant_id, conversation_id)


async def handle_chat_message(
    db: AsyncSession,
    tenant_id: str,
    conversation_id: str,
    user_input: str,
    use_rag: bool,
    chain: ConversationChainService,
) -> None:
    conversation_service = ConversationService(db, tenant_id)
    await conversation_service.add_message(
        conversation_id=conversation_id,
        role="user",
        content=user_input,
    )

    sources: list[dict] = []
    if use_rag:
        _, sources = await _build_rag_context(db, tenant_id, user_input)
        knowledge_items = [
            {
                "knowledge_id": source["knowledge_id"],
                "title": source["title"],
                "content": source["content"],
                "source": source["source"],
            }
            for source in sources
        ]
        result = await chain.chat_with_rag(
            user_input=user_input,
            knowledge_items=knowledge_items,
        )
    else:
        result = await chain.chat(user_input=user_input)

    response = result["response"]
    await conversation_service.add_message(
        conversation_id=conversation_id,
        role="assistant",
        content=response,
        input_tokens=result.get("input_tokens", 0),
        output_tokens=result.get("output_tokens", 0),
    )
    await connection_manager.send_text_message(
        tenant_id=tenant_id,
        conversation_id=conversation_id,
        content=response,
        role="assistant",
    )
    await _send_metadata(
        tenant_id,
        conversation_id,
        model=result.get("model"),
        input_tokens=result.get("input_tokens", 0),
        output_tokens=result.get("output_tokens", 0),
        used_rag=use_rag,
        sources=sources,
    )


@router.websocket("/chat/stream")
async def websocket_chat_stream_endpoint(
    websocket: WebSocket,
    api_key: str = Query(..., description="API Key or JWT token"),
    conversation_id: str = Query(..., description="Conversation ID"),
):
    tenant_id = None
    try:
        async with AsyncSessionLocal() as db:
            tenant_id = await verify_websocket_auth(api_key, db)
            await connection_manager.connect(websocket, tenant_id, conversation_id)
            chain = ConversationChainService(
                db=db,
                tenant_id=tenant_id,
                conversation_id=conversation_id,
            )
            await chain.initialize()

            while True:
                try:
                    raw = await websocket.receive_text()
                    message_data = json.loads(raw)

                    if message_data.get("type") == "ping":
                        await connection_manager.send_message(
                            tenant_id,
                            conversation_id,
                            {"type": "pong", "timestamp": datetime.now().isoformat()},
                        )
                        continue

                    user_input = (message_data.get("content") or "").strip()
                    if not user_input:
                        continue

                    use_rag = bool(message_data.get("use_rag", False))
                    conversation_service = ConversationService(db, tenant_id)
                    await conversation_service.add_message(
                        conversation_id=conversation_id,
                        role="user",
                        content=user_input,
                    )

                    prompt_service = PromptService()
                    system_prompt = prompt_service.get_system_prompt()
                    sources: list[dict] = []
                    if use_rag:
                        context, sources = await _build_rag_context(db, tenant_id, user_input)
                        if context:
                            system_prompt = (
                                f"{system_prompt}\n\n"
                                "Use the following knowledge base content first. "
                                "Answer briefly like an ecommerce support agent. "
                                "If the user only greets you, still mention that you can help based on the knowledge base.\n\n"
                                f"{context}"
                            )

                    messages = chain.memory.get_chat_history().copy()
                    messages.append({"role": "user", "content": user_input})

                    full_response = ""
                    input_tokens = 0
                    output_tokens = 0
                    model = None

                    try:
                        async for chunk in chain.llm_service.astream(messages, system_prompt):
                            if chunk["type"] == "chunk":
                                full_response += chunk["content"]
                                await connection_manager.send_streaming_chunk(
                                    tenant_id,
                                    conversation_id,
                                    chunk["content"],
                                    is_final=False,
                                )
                            elif chunk["type"] == "done":
                                input_tokens = chunk.get("input_tokens", 0)
                                output_tokens = chunk.get("output_tokens", 0)
                                model = chunk.get("model")
                                await connection_manager.send_streaming_chunk(
                                    tenant_id,
                                    conversation_id,
                                    "",
                                    is_final=True,
                                )
                                await _send_metadata(
                                    tenant_id,
                                    conversation_id,
                                    model=model,
                                    input_tokens=input_tokens,
                                    output_tokens=output_tokens,
                                    used_rag=use_rag,
                                    sources=sources,
                                )
                    except Exception as llm_error:
                        source_hint = (
                            f"Knowledge base source: {sources[0]['title']}."
                            if sources
                            else "No knowledge base source matched."
                        )
                        full_response = (
                            f"Hello, I received your message: {user_input}. "
                            f"{source_hint} The demo chat path is available; "
                            "if DeepSeek is temporarily unavailable, this local fallback response is shown first."
                        )
                        await connection_manager.send_streaming_chunk(
                            tenant_id,
                            conversation_id,
                            full_response,
                            is_final=False,
                        )
                        await connection_manager.send_streaming_chunk(
                            tenant_id,
                            conversation_id,
                            "",
                            is_final=True,
                        )
                        await _send_metadata(
                            tenant_id,
                            conversation_id,
                            model="local-fallback",
                            used_rag=use_rag,
                            sources=sources,
                            error=str(llm_error),
                        )

                    await conversation_service.add_message(
                        conversation_id=conversation_id,
                        role="assistant",
                        content=full_response,
                        input_tokens=input_tokens,
                        output_tokens=output_tokens,
                    )
                    chain.memory.add_user_message(user_input)
                    chain.memory.add_ai_message(full_response)

                except WebSocketDisconnect:
                    break
                except json.JSONDecodeError:
                    await connection_manager.send_error(
                        tenant_id,
                        conversation_id,
                        "Invalid JSON message",
                    )
                except Exception as exc:
                    await connection_manager.send_error(
                        tenant_id,
                        conversation_id,
                        str(exc),
                    )

    except AuthenticationException as exc:
        await websocket.close(code=1008, reason=str(exc))
    except Exception:
        await websocket.close(code=1011, reason="Internal server error")
    finally:
        if tenant_id:
            connection_manager.disconnect(tenant_id, conversation_id)


@router.get("/connections/stats")
async def get_websocket_stats():
    return {"success": True, "data": connection_manager.get_stats()}

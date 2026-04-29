import asyncio
import logging
from contextlib import asynccontextmanager
from functools import partial

from fastapi import APIRouter, FastAPI, status
from graphiti_core.embedder.openai import OpenAIEmbedder, OpenAIEmbedderConfig  # type: ignore
from graphiti_core.nodes import EpisodeType  # type: ignore
from graphiti_core.utils.maintenance.graph_data_operations import clear_data  # type: ignore

from graph_service.config import get_settings
from graph_service.dto import AddEntityNodeRequest, AddMessagesRequest, Message, Result
from graph_service.zep_graphiti import ZepGraphiti, ZepGraphitiDep

logger = logging.getLogger(__name__)


def _make_graphiti() -> ZepGraphiti:
    """Creates a fresh Graphiti client from settings.

    Each background task needs its own client because FastAPI closes
    request-scoped dependencies before the worker runs the queued job.
    """
    s = get_settings()
    embedder = OpenAIEmbedder(config=OpenAIEmbedderConfig(
        api_key=s.openai_api_key,
        base_url=s.openai_base_url,
        embedding_model=s.embedding_model_name or 'titan-embed-text-v2',
    ))
    client = ZepGraphiti(uri=s.neo4j_uri, user=s.neo4j_user, password=s.neo4j_password, embedder=embedder)
    if s.openai_base_url:
        client.llm_client.config.base_url = s.openai_base_url
    if s.openai_api_key:
        client.llm_client.config.api_key = s.openai_api_key
    if s.model_name:
        client.llm_client.model = s.model_name
    return client


class AsyncWorker:
    def __init__(self):
        self.queue = asyncio.Queue()
        self.task = None

    async def worker(self):
        while True:
            try:
                job = await self.queue.get()
                remaining = self.queue.qsize()
                logger.info(f'Processing job (queue remaining: {remaining})')
                await job()
                self.queue.task_done()
            except asyncio.CancelledError:
                break
            except Exception as e:
                # Log and continue — do NOT let one bad episode kill the worker
                logger.error(f'Job failed, skipping: {type(e).__name__}: {e}')
                self.queue.task_done()

    async def start(self):
        self.task = asyncio.create_task(self.worker())

    async def stop(self):
        if self.task:
            self.task.cancel()
            await self.task
        while not self.queue.empty():
            self.queue.get_nowait()


async_worker = AsyncWorker()


@asynccontextmanager
async def lifespan(_: FastAPI):
    await async_worker.start()
    yield
    await async_worker.stop()


router = APIRouter(lifespan=lifespan)


@router.post('/messages', status_code=status.HTTP_202_ACCEPTED)
async def add_messages(request: AddMessagesRequest):
    async def add_messages_task(m: Message):
        # Fresh client per task — avoids using a closed request-scoped client
        graphiti = _make_graphiti()
        try:
            await graphiti.add_episode(
                uuid=m.uuid,
                group_id=request.group_id,
                name=m.name,
                episode_body=f'{m.role or ""}({m.role_type}): {m.content}',
                reference_time=m.timestamp,
                source=EpisodeType.message,
                source_description=m.source_description,
            )
        finally:
            await graphiti.close()

    for m in request.messages:
        await async_worker.queue.put(partial(add_messages_task, m))

    return Result(message='Messages added to processing queue', success=True)


@router.post('/entity-node', status_code=status.HTTP_201_CREATED)
async def add_entity_node(
    request: AddEntityNodeRequest,
    graphiti: ZepGraphitiDep,
):
    node = await graphiti.save_entity_node(
        uuid=request.uuid,
        group_id=request.group_id,
        name=request.name,
        summary=request.summary,
    )
    return node


@router.delete('/entity-edge/{uuid}', status_code=status.HTTP_200_OK)
async def delete_entity_edge(uuid: str, graphiti: ZepGraphitiDep):
    await graphiti.delete_entity_edge(uuid)
    return Result(message='Entity Edge deleted', success=True)


@router.delete('/group/{group_id}', status_code=status.HTTP_200_OK)
async def delete_group(group_id: str, graphiti: ZepGraphitiDep):
    await graphiti.delete_group(group_id)
    return Result(message='Group deleted', success=True)


@router.delete('/episode/{uuid}', status_code=status.HTTP_200_OK)
async def delete_episode(uuid: str, graphiti: ZepGraphitiDep):
    await graphiti.delete_episodic_node(uuid)
    return Result(message='Episode deleted', success=True)


@router.post('/clear', status_code=status.HTTP_200_OK)
async def clear(graphiti: ZepGraphitiDep):
    await clear_data(graphiti.driver)
    await graphiti.build_indices_and_constraints()
    return Result(message='Graph cleared', success=True)

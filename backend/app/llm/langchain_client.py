"""Optional LangChain layer.

Install with ``pip install -r requirements-langchain.txt``. When those
packages are absent, :func:`available` is False and the API falls back
to the httpx adapters in ``providers.py`` — the feature never breaks
because an optional dependency is missing.

When present, this builds a real LangChain chain: a ChatPromptTemplate
(system + human) piped into the provider's chat model, invoked with the
user's key. The key is passed to the model constructor only, never
persisted by PromptGPT.
"""

from __future__ import annotations


def available() -> bool:
    try:
        import langchain_core  # noqa: F401
        import langchain_openai  # noqa: F401
    except ImportError:
        return False
    return True


async def run_with_langchain(
    provider: str, model: str, prompt: str, system: str, api_key: str, base_url: str
) -> str:
    if provider == "openai":
        from langchain_openai import ChatOpenAI

        llm = ChatOpenAI(model=model, api_key=api_key, temperature=0.7)
    elif provider == "anthropic":
        from langchain_anthropic import ChatAnthropic

        llm = ChatAnthropic(model=model, api_key=api_key, temperature=0.7)
    elif provider == "google":
        from langchain_google_genai import ChatGoogleGenerativeAI

        llm = ChatGoogleGenerativeAI(model=model, google_api_key=api_key, temperature=0.7)
    elif provider == "openai-compatible":
        from langchain_openai import ChatOpenAI

        llm = ChatOpenAI(
            model=model, api_key=api_key or "local", base_url=base_url, temperature=0.7
        )
    elif provider == "huggingface":
        from langchain_huggingface import ChatHuggingFace, HuggingFaceEndpoint

        endpoint = HuggingFaceEndpoint(repo_id=model, huggingfacehub_api_token=api_key)
        llm = ChatHuggingFace(llm=endpoint)
    else:
        raise ValueError(f"LangChain adapter not implemented for provider: {provider}")

    from langchain_core.prompts import ChatPromptTemplate

    template = ChatPromptTemplate.from_messages(
        [("system", "{system}"), ("human", "{prompt}")]
    )
    chain = template | llm
    result = await chain.ainvoke(
        {"system": system or "You are a helpful assistant.", "prompt": prompt}
    )
    return result.content if isinstance(result.content, str) else str(result.content)

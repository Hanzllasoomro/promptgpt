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
    provider: str,
    model: str,
    prompt: str,
    system: str,
    api_key: str,
    base_url: str,
    messages: list[dict] | None = None,
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

    # Message objects, not a string template: user content may contain
    # braces, which a template would mistake for variables. With history
    # the turns are sent as-is (capped like the httpx adapters); without
    # it the single prompt is the only human message.
    from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

    turns = [
        m for m in (messages or [])
        if m.get("role") in ("user", "assistant") and m.get("content")
    ]
    if not turns or turns[-1]["role"] != "user" or turns[-1]["content"] != prompt:
        turns.append({"role": "user", "content": prompt})
    turns = turns[-20:]
    chat_messages = [SystemMessage(system or "You are a helpful assistant.")]
    for turn in turns:
        chat_messages.append(
            HumanMessage(turn["content"])
            if turn["role"] == "user"
            else AIMessage(turn["content"])
        )
    result = await llm.ainvoke(chat_messages)
    return result.content if isinstance(result.content, str) else str(result.content)

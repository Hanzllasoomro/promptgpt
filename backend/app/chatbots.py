"""'Send to your favourite chatbot' links.

Honesty matters here: only some chatbots accept a prompt through a URL
parameter. For those, we build a prefilled link. For the rest we return
the chatbot's home/chat URL with ``prefilled=False`` and the frontend
copies the prompt to the clipboard first, so the user pastes once.
Claiming prefill for a chatbot that ignores the parameter would be a
broken feature dressed up as one.
"""

from __future__ import annotations

import urllib.parse

from .models import ChatbotInfo

# (id, name, prefill URL template with {q}, note)
_PREFILLED = [
    (
        "chatgpt",
        "ChatGPT",
        "https://chatgpt.com/?q={q}",
        "Opens a new ChatGPT chat with your prompt prefilled.",
    ),
    (
        "claude",
        "Claude",
        "https://claude.ai/new?q={q}",
        "Opens a new Claude chat with your prompt prefilled.",
    ),
    (
        "gemini",
        "Gemini",
        "https://gemini.google.com/app?q={q}",
        "Opens Gemini with your prompt prefilled.",
    ),
    (
        "perplexity",
        "Perplexity",
        "https://www.perplexity.ai/search?q={q}",
        "Opens a Perplexity search with your prompt prefilled.",
    ),
    (
        "copilot",
        "Microsoft Copilot",
        "https://copilot.microsoft.com/?q={q}",
        "Opens Copilot with your prompt prefilled, where supported.",
    ),
]

# Chatbots with no documented prompt URL parameter: copy-and-paste flow.
_COPY_FIRST = [
    ("mistral", "Mistral Le Chat", "https://chat.mistral.ai/chat"),
    ("deepseek", "DeepSeek", "https://chat.deepseek.com/"),
    ("grok", "Grok", "https://grok.com/"),
    ("meta-ai", "Meta AI", "https://www.meta.ai/"),
    ("poe", "Poe", "https://poe.com/"),
]


def chatbot_links(prompt: str) -> list[ChatbotInfo]:
    q = urllib.parse.quote(prompt.strip(), safe="")
    links = [
        ChatbotInfo(id=cid, name=name, url=template.format(q=q), prefilled=True, note=note)
        for cid, name, template, note in _PREFILLED
    ]
    links += [
        ChatbotInfo(
            id=cid,
            name=name,
            url=url,
            prefilled=False,
            note="This chatbot has no prompt URL parameter, so PromptGPT copies the prompt first — paste it after the chat opens.",
        )
        for cid, name, url in _COPY_FIRST
    ]
    return links

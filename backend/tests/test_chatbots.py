from app.chatbots import chatbot_links


def test_prefilled_links_encode_prompt():
    links = chatbot_links("hello world & friends?")
    by_id = {c.id: c for c in links}
    assert by_id["chatgpt"].prefilled
    assert "hello%20world%20%26%20friends%3F" in by_id["chatgpt"].url
    assert by_id["claude"].url.startswith("https://claude.ai/new?q=")


def test_copy_first_chatbots_are_honest():
    links = chatbot_links("test")
    by_id = {c.id: c for c in links}
    assert not by_id["deepseek"].prefilled
    assert "?" not in by_id["deepseek"].url.split("/")[-1]
    assert len(links) >= 8

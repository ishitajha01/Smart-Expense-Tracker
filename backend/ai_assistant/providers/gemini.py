import json
import logging
import os
import socket
import ssl
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from django.core.exceptions import ImproperlyConfigured

from .base import LLMProvider

logger = logging.getLogger(__name__)


class ProviderError(Exception):
    """A safe, user-displayable provider failure."""


class GeminiProvider(LLMProvider):
    def generate_reply(self, history, system_prompt):
        api_key = os.getenv("GEMINI_API_KEY", "").strip()
        if not api_key:
            raise ImproperlyConfigured("GEMINI_API_KEY is not configured")

        model = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite").strip()
        url = "https://generativelanguage.googleapis.com/v1beta/interactions"
        transcript = "\n\n".join(
            f"{'Sprout' if item['role'] == 'assistant' else 'User'}: {item['content']}"
            for item in history
        )
        body = {
            "model": model,
            "input": transcript,
            "system_instruction": system_prompt,
            "generation_config": {
                "max_output_tokens": 700,
                "thinking_level": "low",
            },
            # Sprout keeps its own authenticated history; don't persist a second
            # copy of financial prompts in Google's interaction history.
            "store": False,
        }
        request = Request(
            url,
            data=json.dumps(body).encode("utf-8"),
            headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
            method="POST",
        )
        try:
            with urlopen(request, timeout=60) as response:
                payload = json.loads(response.read().decode("utf-8"))
            parts = [
                content
                for step in payload.get("steps", [])
                if step.get("type") == "model_output"
                for content in step.get("content", [])
                if content.get("type") == "text"
            ]
            answer = "\n".join(part.get("text", "") for part in parts).strip()
            if not answer:
                raise ProviderError("Sprout couldn't form a reply. Please try again.")
            return answer
        except HTTPError as exc:
            logger.warning("Gemini request failed with HTTP status %s", exc.code)
            if exc.code in (401, 403):
                detail = "Gemini rejected the API key. Check that it is active and enabled for the Gemini API."
            elif exc.code == 404:
                detail = f"Gemini model '{model}' was not found or isn't available to this API key. Check GEMINI_MODEL."
            elif exc.code == 429:
                detail = "Gemini's request limit or quota was reached. Check your Google AI Studio project quota and try again later."
            elif 400 <= exc.code < 500:
                detail = "Gemini rejected this request. Check the configured model and try a shorter message."
            else:
                detail = "Gemini is temporarily unavailable. Please try again shortly."
            raise ProviderError(detail) from exc
        except (URLError, TimeoutError) as exc:
            reason = getattr(exc, "reason", exc)
            logger.warning(
                "Gemini connection failed (reason_type=%s, errno=%s)",
                type(reason).__name__, getattr(reason, "errno", None),
            )
            if isinstance(reason, socket.gaierror):
                detail = "The Django server can't resolve Google's Gemini hostname. Enable DNS/internet access for the backend process."
            elif isinstance(reason, ssl.SSLError):
                detail = "The Django server couldn't establish a secure connection to Google. Check its HTTPS proxy or certificate configuration."
            elif isinstance(reason, (TimeoutError, socket.timeout)):
                detail = "The connection to Gemini timed out. Check that the backend can make outbound HTTPS connections."
            else:
                detail = "The Django server can't reach Gemini. Check its internet, DNS, firewall, or HTTPS proxy settings."
            raise ProviderError(detail) from exc
        except (IndexError, KeyError, ValueError) as exc:
            logger.warning("Gemini returned an unexpected response (%s)", type(exc).__name__)
            raise ProviderError("Gemini returned an unexpected response. Please try again shortly.") from exc

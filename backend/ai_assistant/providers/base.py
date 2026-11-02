from abc import ABC, abstractmethod


class LLMProvider(ABC):
    @abstractmethod
    def generate_reply(self, history, system_prompt):
        """Return one assistant reply from the supplied conversation context."""
        raise NotImplementedError

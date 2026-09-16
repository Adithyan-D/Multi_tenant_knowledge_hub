from typing import List
from fastembed import TextEmbedding

class EmbeddingService:
    _instance = None
    _model = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(EmbeddingService, cls).__new__(cls)
        return cls._instance

    def _get_model(self) -> TextEmbedding:
        if self._model is None:
            # BAAI/bge-small-en-v1.5 generates 384-dimensional dense vectors using ONNX runtime locally
            self._model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
        return self._model

    def embed_text(self, text: str) -> List[float]:
        """Generate embedding vector for a single string."""
        model = self._get_model()
        embeddings = list(model.embed([text]))
        return embeddings[0].tolist()

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Generate embedding vectors for a batch of strings."""
        if not texts:
            return []
        model = self._get_model()
        embeddings = list(model.embed(texts))
        return [e.tolist() for e in embeddings]

embedding_service = EmbeddingService()

FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 HF_HOME=/app/.cache PIP_NO_CACHE_DIR=1
RUN useradd -m -u 1000 user
WORKDIR /app
COPY requirements.txt .
RUN pip install --index-url https://download.pytorch.org/whl/cpu torch && pip install -r requirements.txt
# 임베딩 모델을 이미지에 미리 받아 둔다(첫 기동 지연 줄이기)
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('BAAI/bge-m3', device='cpu')"
COPY --chown=user . .
RUN chmod +x start.sh && chown -R user /app
USER user
EXPOSE 8080
CMD ["./start.sh"]

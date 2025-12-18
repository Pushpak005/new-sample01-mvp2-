FROM python:3.11-slim
WORKDIR /app
COPY etl.py .
# data is expected at ../data (compose mounts ./data)
RUN apt-get update && apt-get install -y --no-install-recommends sqlite3 && rm -rf /var/lib/apt/lists/*
CMD ["python","etl.py"]

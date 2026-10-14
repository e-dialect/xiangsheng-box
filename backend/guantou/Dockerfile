FROM python:3.12-bookworm

WORKDIR /usr/src/guantou-backend

# Update apt sources to use Huawei Cloud mirror
RUN sed -i 's@deb.debian.org@repo.huaweicloud.com@g' /etc/apt/sources.list.d/debian.sources

# Install system dependencies
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN ffmpeg -version >/dev/null
RUN ffprobe -version >/dev/null

# Copy and install Python dependencies
COPY requirements.txt .
RUN python -m pip install --no-cache-dir --upgrade pip && \
    python -m pip install --no-cache-dir -i https://mirrors.aliyun.com/pypi/simple/ -r requirements.txt

# Copy application code
COPY . .

RUN python manage.py collectstatic --noinput

RUN groupadd --gid 10001 app && useradd --uid 10001 --gid 10001 --no-create-home app && \
    mkdir -p /data/logs /data/media && chown -R 10001:10001 /data && \
    chmod -R a+rX /usr/src/guantou-backend

EXPOSE 8000

CMD ["sh", "docker/entrypoint.sh"]

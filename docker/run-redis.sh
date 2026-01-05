#!/usr/bin/env bash
set -e

docker rm -f dmf-redis 2>/dev/null || true

docker run -d \
  --name dmf-redis \
  --restart always \
  -p "${REDIS_PORT}:6379" \
  -e REDIS_PASSWORD="${REDIS_PASSWORD}" \
  -e REDIS_USER="${REDIS_USER}" \
  -e REDIS_USER_PASSWORD="${REDIS_USER_PASSWORD}" \
  -v "${REDIS_DATA_PATH}:/data" \
  -t -i \
  redis:latest \
  sh -c '
    mkdir -p /usr/local/etc/redis &&

    echo "bind 0.0.0.0" > /usr/local/etc/redis/redis.conf &&
    echo "requirepass $REDIS_PASSWORD" >> /usr/local/etc/redis/redis.conf &&
    echo "appendonly yes" >> /usr/local/etc/redis/redis.conf &&
    echo "appendfsync everysec" >> /usr/local/etc/redis/redis.conf &&

    echo "user default on nopass ~* +@all" > /usr/local/etc/redis/users.acl &&
    echo "user $REDIS_USER on >$REDIS_USER_PASSWORD ~* +@all" >> /usr/local/etc/redis/users.acl &&

    redis-server /usr/local/etc/redis/redis.conf --aclfile /usr/local/etc/redis/users.acl
  '

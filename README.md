# Drop me Files (analog)

Аналог сервиса [dropmefiles.com](https://dropmefiles.com) — веб-приложение для временного обмена файлами с прямой загрузкой в S3-совместимое хранилище.

Попробовать демо: [dropmefiles.viaproger.ru](https://dropmefiles.viaproger.ru/)

## 📋 Описание

Drop-me-files-analog позволяет пользователям:
- Загружать файлы через веб-интерфейс
- Получать короткие ссылки для скачивания (6-символьный UUID)

Файлы загружаются напрямую в S3-совместимое хранилище (MinIO) с использованием presigned URLs, что снижает нагрузку на backend-сервер. Файлы в S3 хранилище автоматически удаляются с течением времени, и доступ к ним исчезает.

## 🏗️ Архитектура

Проект построен на микросервисной архитектуре и состоит из нескольких компонентов:

**Frontend**: статическое веб-приложение (HTML, CSS, JS), предоставляющее интерфейс для загрузки и скачивания файлов. Взаимодействует с Backend через REST API.

**Backend (FastAPI)**: API-шлюз, который генерирует presigned URLs для прямого взаимодействия клиента с S3-хранилищем, управляет метаданными файлов, валидирует запросы и логирует операции.

**MinIO**: S3-совместимое хранилище для файлов. Доступ к файлам возможен только через presigned URLs с ограниченным временем жизни.

**Redis**: хранилище метаданных файлов. Записи автоматически удаляются по истечении TTL.

**Nginx**: служит веб-сервером для раздачи frontend и reverse proxy для backend.

Процесс работы:

1. **Загрузка**: **Frontend** запрашивает токен, передавая метаданные файла. **Backend** генерирует короткий UUID и presigned POST URL для **MinIO**, сохраняет метаданные в **Redis** с TTL и возвращает URL и UUID. Frontend загружает файл напрямую в **MinIO**.

2. **Скачивание**: По запросу с UUID **backend** проверяет **Redis**, генерирует presigned GET URL и возвращает его клиенту с метаданными. Файл скачивается напрямую из **MinIO**.

3. **Очистка**: По истечении TTL запись удаляется из **Redis**; Файл в **MinIO** удаляется по правилам конфигурации S3 хранилища (в данном проекте, TTL MinIO равен 1 суткам).

## 🛠️ Технологический стек

### Backend
- **Python 3.14**
- **FastAPI** — современный асинхронный веб-фреймворк
- **Uvicorn** — ASGI сервер
- **aiobotocore** — асинхронный клиент для S3-совместимых хранилищ
- **redis** — клиент Redis
- **Pydantic** — валидация данных
- **Loguru** — логирование

### Frontend
- **HTML**, **CSS**, **JavaScript** — базовый стек

### Инфраструктура
- **Docker** и **Docker Compose** — для быстрой развертки сервисов
- **MinIO** — S3-совместимое хранилище
- **Redis** — кэш и хранилище метаданных
- **Nginx** — веб-сервер

## 📦 Установка и запуск

### Предварительные требования

- **Docker** и **Docker Compose** — для запуска MinIO и Redis
- **Python 3.14** — для локальной разработки backend
- **UV** пакетный менеджер (рекомендуется)

### Установка

1. **Клонируйте репозиторий:**
```bash
git clone https://github.com/IgorVolochay/Drop-me-files-analog.git
cd Drop-me-files-analog
```

2. **Создайте файл `.env`** на основе примера:
```bash
cp app/.env-example app/.env
cp docker/.env-example docker/.env
```
Затем отредактируйте `.env` и укажите необходимые значения (см. раздел "Конфигурация").

3. **Запустите сервисы (MinIO и Redis) через Docker Compose:**
```bash
cd docker
docker-compose up -d
```

Это запустит:
- MinIO на указанных портах 9000 (API) и 9001 (Веб-интерфейс)
- Автоматическую инициализацию бакета MinIO и TTL
- Redis на порту 6380


4. **Установите зависимости и запустите backend:**
```bash
cd ../app
uv sync  # или pip install ..
uv run main.py
```

Backend будет доступен на `http://localhost:8000` (или порт из `BACKEND_PORT` в `.env`).

5. **Запустите frontend:**
   
В режиме разработки используйте любой статический сервер:

```bash
     cd frontend
     python -m http.server 8080
     # или
     npx serve .
```

В production настройте Nginx для раздачи статических файлов из `frontend/` и проксирования API запросов на backend.


## ⚙️ Конфигурация

### Переменные окружения

В проекте есть пример файла конфигурации `app/.env-example`. Скопируйте его и создайте файл `.env` в корне проекта или в папке `app/` со следующими переменными:

```python
DISABLE_DOCS=false # Отключение базового FastAPI endpoint /docs
BACKEND_PORT=8000 # Сетевой порт FastAPI Backend

LOGS_PATH=./logs # Директория для хранения логов

FILES_TTL=86400 # Время хранения файла (указан 1 день)
MAX_FILES_SIZE=1073741824 # Максимальный размер файла в байтах (указан 1 GB)

# Переменные для подключения к S3 хранилищу
S3_ACCESS_KEY_ID=Some_username
S3_SECRET_ACCESS_KEY=Some_password
S3_ENDPOINT_URL=Some_url
BUCKET_NAME=drop-me-files

# Переменные для подключения к Redis
REDIS_ADDRESS=Some_url
REDIS_PORT=6379
REDIS_USERNAME=Some_username
REDIS_PASSWORD=Some_password
```


## 🔧 Разработка

### Структура проекта

```
Drop-me-files-analog/
├── app/                   # Backend приложение
│   ├── main.py            # Главный файл FastAPI приложения
│   ├── s3_worker.py       # Обработчик S3/MinIO
│   ├── redis_worker.py    # Обработчик Redis
│   ├── schemas/           # Pydantic схемы
│   │   └── api_schemas.py
│   └── pyproject.toml     # Зависимости проекта
├── frontend/              # Frontend приложение
│   ├── index.html
│   ├── script.js
│   └── style.css
├── docker/
│   └── docker-compose.yml # Docker конфигурация для запуска MinIO и Redis
└── README.md              # Этот файл
```

### Логирование

Логи сохраняются в файл: `{LOGS_PATH}/dmf-logs.log` (ротация при 1 MB, сжатие zip)


## 🤝 Вклад

Вклад в проект приветствуется! Пожалуйста:

1. Создайте fork проекта
2. Создайте ветку для новой функции (`git checkout -b feature/AmazingFeature`)
3. Зафиксируйте изменения (`git commit -m 'Add some AmazingFeature'`)
4. Отправьте в ветку (`git push origin feature/AmazingFeature`)
5. Откройте Pull Request

## 📞 Контакты

- **GitHub проекта:** [IgorVolochay/Drop-me-files-analog](https://github.com/IgorVolochay/Drop-me-files-analog)
- **Автор:** Игорь Волочай

Если нашли баг или уязвимость, пишите на почту (pseudo.developer.ru@gmail.com) или открывайте **Issues** на GitHub!

## 🙏 Благодарности

- Проект вдохновлён сервисом [dropmefiles.com](https://dropmefiles.com)
- Использует открытые технологии: [FastAPI](https://github.com/fastapi/fastapi), [MinIO](https://github.com/minio/minio), [Redis](https://github.com/redis/redis)

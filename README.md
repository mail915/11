# TaskFlow — продукт для управления проектами и задачами

Монорепозиторий из трёх частей, работающих с одним API:

- `backend/` — REST API (Node.js + Express + TypeScript + PostgreSQL через Prisma)
- `web/` — веб-приложение (React + Vite + TypeScript), одновременно работает как PWA
- `mobile/` — нативное мобильное приложение для iOS/Android (React Native + Expo)

## Функциональность

- Регистрация/вход по email и паролю (JWT)
- Команды (workspace) и участники команд
- Проекты внутри команды
- Задачи: статусы (To Do / In Progress / Done), приоритет, дедлайн, исполнитель
- Канбан-доска с перетаскиванием задач между статусами (веб) / кнопками смены статуса (мобильное)
- Комментарии к задачам
- Уведомления: назначение на задачу, смена статуса, новый комментарий, добавление в команду

## Быстрый старт

### 1. База данных

```bash
docker compose up -d postgres
```

### 2. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run prisma:migrate   # создаёт таблицы в PostgreSQL
npm run dev               # http://localhost:4000
```

### 3. Веб-приложение

```bash
cd web
npm install
npm run dev                # http://localhost:5173, проксирует /api на backend
```

Веб-приложение можно установить на телефон как PWA (кнопка «Добавить на главный экран» в браузере) — это самый быстрый способ получить мобильную версию без публикации в стор.

### 4. Мобильное приложение (React Native / Expo)

```bash
cd mobile
npm install
npm start                  # откроется Expo Dev Tools / QR-код
```

По умолчанию мобильное приложение обращается к `http://10.0.2.2:4000/api` (Android-эмулятор) или `http://localhost:4000/api` (iOS-симулятор/веб). Для физического устройства укажите IP компьютера в сети:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.50:4000/api npm start
```

Для публикации в App Store / Google Play используется `eas build` (Expo Application Services) — потребуется аккаунт Expo и учётные записи разработчика Apple/Google.

## Архитектура

```
   ┌────────────┐        ┌────────────┐
   │  web (PWA) │        │   mobile   │
   │ React+Vite │        │ Expo/RN    │
   └─────┬──────┘        └─────┬──────┘
         │        REST/JSON    │
         └──────────┬──────────┘
                     │
              ┌──────▼──────┐
              │   backend   │
              │ Express API │
              └──────┬──────┘
                     │ Prisma
              ┌──────▼──────┐
              │ PostgreSQL  │
              └─────────────┘
```

## Дальнейшие шаги (не входят в MVP)

- Права доступа на уровне ролей проекта (сейчас — на уровне команды)
- Push-уведомления на мобильном (Expo Notifications)
- Вложения к задачам и файлы
- Фильтры/поиск, теги, подзадачи
- Публикация в App Store / Google Play через EAS Build

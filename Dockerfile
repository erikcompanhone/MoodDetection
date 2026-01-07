# frontend
FROM node:25.2.1-alpine3.21 AS frontend
WORKDIR /web
COPY package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# backend
FROM python:3.14.1-slim-bullseye AS backend
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ ./

# final
COPY --from=frontend /web/dist ./static
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
@echo off
echo ======================================================
echo           VereadorCRM - Instalador Mestre
echo ======================================================
echo.

:: 1. Verificar Docker
echo [1/6] Verificando Docker...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Docker nao encontrado! Instale o Docker Desktop primeiro.
    pause
    exit /b
)

:: 2. Subir Containers
echo [2/6] Iniciando Banco de Dados e Redis (Docker)...
docker-compose up -d
if %errorlevel% neq 0 (
    echo [ERRO] Falha ao subir containers. Verifique se o Docker esta rodando.
    pause
    exit /b
)

:: 3. Instalar dependencias Backend
echo [3/6] Instalando dependencias do Backend...
cd backend
call npm.cmd install
if %errorlevel% neq 0 (
    echo [ERRO] Falha ao instalar dependencias do backend.
    cd ..
    pause
    exit /b
)

:: 4. Configurar Banco de Dados
echo [4/6] Configurando Schema do Banco de Dados (Drizzle)...
call npx.cmd drizzle-kit push
if %errorlevel% neq 0 (
    echo [ERRO] Falha ao configurar banco. Verifique se a porta 5432 esta livre.
    cd ..
    pause
    exit /b
)

echo [5/6] Criando usuario Super Admin (super@admin.com / admin123)...
call npx.cmd tsx src/scripts/seed.ts
cd ..

:: 5. Instalar dependencias Frontend
echo [6/6] Instalando dependencias do Frontend...
cd frontend
call npm.cmd install
cd ..

echo.
echo ======================================================
echo           INSTALACAO CONCLUIDA COM SUCESSO!
echo ======================================================
echo.
echo Para rodar o sistema agora:
echo 1. No terminal 1: cd backend ^&^& npm run dev
echo 2. No terminal 2: cd frontend ^&^& npm run dev
echo.
echo LOGIN: super@admin.com
echo SENHA: admin123
echo.
echo IMPORTANTE: Nao esqueca de colocar sua GEMINI_API_KEY no arquivo backend/.env
echo ======================================================
pause

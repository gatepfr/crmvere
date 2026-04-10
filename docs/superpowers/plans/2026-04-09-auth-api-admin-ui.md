# Phase 2: Auth API & Super Admin Interface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Login API, Super Admin routes for tenant management, and basic frontend interfaces for authentication and administration.

**Architecture:** Express backend providing REST endpoints. React frontend with basic routing and auth context.

**Tech Stack:** Express, jsonwebtoken, bcryptjs, React, react-router-dom, axios.

---

### Task 1: Backend Server Setup & Auth Controller

**Files:**
- Create: `backend/src/app.ts`
- Create: `backend/src/controllers/authController.ts`
- Create: `backend/src/routes/authRoutes.ts`

- [ ] **Step 1: Setup Express Server in app.ts**

```typescript
import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import authRoutes from './routes/authRoutes';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

export default app;
```

- [ ] **Step 2: Implement login controller**

```typescript
import { Request, Response } from 'express';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign(
    { id: user.id, tenantId: user.tenantId, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: '1h' }
  );
  res.json({ token, user: { id: user.id, email: user.email, role: user.role, tenantId: user.tenantId } });
};
```

- [ ] **Step 3: Setup auth routes**

```typescript
import { Router } from 'express';
import { login } from '../controllers/authController';

const router = Router();
router.post('/login', login);
export default router;
```

- [ ] **Step 4: Commit**

```bash
git add backend/src
git commit -m "feat: setup backend server and auth routes"
```

---

### Task 2: Super Admin Tenant API

**Files:**
- Create: `backend/src/controllers/superAdminController.ts`
- Create: `backend/src/routes/superAdminRoutes.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Implement tenant management controller**

```typescript
import { Request, Response } from 'express';
import { db } from '../db';
import { tenants } from '../db/schema';

export const createTenant = async (req: Request, res: Response) => {
  const { name, slug } = req.body;
  const [newTenant] = await db.insert(tenants).values({ name, slug }).returning();
  res.status(201).json(newTenant);
};

export const listTenants = async (req: Request, res: Response) => {
  const allTenants = await db.select().from(tenants);
  res.json(allTenants);
};
```

- [ ] **Step 2: Setup super admin routes with middleware**

```typescript
import { Router } from 'express';
import { createTenant, listTenants } from '../controllers/superAdminController';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);
router.use((req, res, next) => {
  if (req.user?.role !== 'super_admin') return res.status(403).json({ error: 'Forbidden' });
  next();
});

router.post('/tenants', createTenant);
router.get('/tenants', listTenants);
export default router;
```

- [ ] **Step 3: Register routes in app.ts**

```typescript
// backend/src/app.ts
import superAdminRoutes from './routes/superAdminRoutes';
// ...
app.use('/api/superadmin', superAdminRoutes);
```

- [ ] **Step 4: Commit**

```bash
git add backend/src
git commit -m "feat: add super admin tenant management api"
```

---

### Task 3: Frontend Base & Auth Context

**Files:**
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/context/AuthContext.tsx`
- Create: `frontend/src/pages/Login.tsx`

- [ ] **Step 1: Setup API client with Axios**

```typescript
import axios from 'axios';

const api = axios.create({ baseURL: 'http://localhost:3001/api' });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
```

- [ ] **Step 2: Create AuthContext for state management**

```typescript
import React, { createContext, useState, useContext } from 'react';

const AuthContext = createContext<any>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));
  const login = (data: any) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
  };
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };
  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
```

- [ ] **Step 3: Create Login Page**

```tsx
import React, { useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/auth/login', { email, password });
      login(data);
      navigate(data.user.role === 'super_admin' ? '/superadmin' : '/dashboard');
    } catch (err) { alert('Login failed'); }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <form onSubmit={handleSubmit} className="p-8 bg-white rounded shadow-md w-96">
        <h2 className="mb-6 text-2xl font-bold">Login VereadorCRM</h2>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className="w-full p-2 mb-4 border rounded" required />
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha" className="w-full p-2 mb-4 border rounded" required />
        <button type="submit" className="w-full p-2 text-white bg-blue-600 rounded">Entrar</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src
git commit -m "feat: setup frontend auth base and login page"
```

---

### Task 4: Super Admin Tenant UI

**Files:**
- Create: `frontend/src/pages/SuperAdmin/Tenants.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create Tenant List & Create UI**

```tsx
import React, { useEffect, useState } from 'react';
import api from '../../api/client';

export default function Tenants() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');

  const loadTenants = async () => {
    const { data } = await api.get('/superadmin/tenants');
    setTenants(data);
  };

  useEffect(() => { loadTenants(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/superadmin/tenants', { name, slug });
    setName(''); setSlug('');
    loadTenants();
  };

  return (
    <div className="p-8">
      <h1 className="mb-6 text-3xl font-bold">Gestão de Gabinetes (Super Admin)</h1>
      <form onSubmit={handleCreate} className="mb-8 flex gap-4">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome do Vereador" className="p-2 border rounded" required />
        <input value={slug} onChange={e => setSlug(e.target.value)} placeholder="slug-do-gabinete" className="p-2 border rounded" required />
        <button type="submit" className="p-2 bg-green-600 text-white rounded">Criar Gabinete</button>
      </form>
      <div className="grid gap-4">
        {tenants.map(t => (
          <div key={t.id} className="p-4 border rounded bg-white shadow-sm flex justify-between items-center">
            <div>
              <span className="font-bold">{t.name}</span>
              <span className="ml-4 text-gray-500">/{t.slug}</span>
            </div>
            <span className={t.active ? 'text-green-600' : 'text-red-600'}>
              {t.active ? 'Ativo' : 'Inativo'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update App.tsx with Routing**

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Tenants from './pages/SuperAdmin/Tenants';

function ProtectedRoute({ children, role }: any) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (role && user.role !== role) return <Navigate to="/" />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/superadmin" element={
            <ProtectedRoute role="super_admin">
              <Tenants />
            </ProtectedRoute>
          } />
          <Route path="/" element={<Navigate to="/login" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src
git commit -m "feat: implement super admin tenant UI"
```

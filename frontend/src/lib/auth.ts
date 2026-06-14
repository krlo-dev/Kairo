import { api } from './api';
import type { AuthUser } from '../store/auth.store';

interface ApiData<T> {
  data: T;
}

export async function register(input: {
  email: string;
  password: string;
  name: string;
}): Promise<AuthUser> {
  const res = await api.post<ApiData<{ user: AuthUser }>>('/auth/register', input);
  return res.data.data.user;
}

export async function login(input: { email: string; password: string }): Promise<AuthUser> {
  const res = await api.post<ApiData<{ user: AuthUser }>>('/auth/login', input);
  return res.data.data.user;
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}

export async function fetchMe(): Promise<AuthUser> {
  const res = await api.get<ApiData<{ user: AuthUser }>>('/auth/me');
  return res.data.data.user;
}

export async function verifyEmail(token: string): Promise<AuthUser> {
  const res = await api.post<ApiData<{ user: AuthUser }>>('/auth/verify-email', { token });
  return res.data.data.user;
}

export async function forgotPassword(email: string): Promise<void> {
  await api.post('/auth/forgot-password', { email });
}

export async function resetPassword(input: { token: string; newPassword: string }): Promise<void> {
  await api.post('/auth/reset-password', input);
}

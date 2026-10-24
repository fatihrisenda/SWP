/** Uji halaman Login & Register (Issue 041/042/061): validasi klien, galat server, dan sukses. */
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { LoginPage } from '../src/pages/LoginPage';
import { RegisterPage, passwordStrength } from '../src/pages/RegisterPage';
import { API_BASE } from '../src/lib/api';
import { db, TEST_PASSWORD } from './handlers';
import { server } from './server';
import { renderWithProviders } from './utils';

const EMAIL = /^Email/;
const PASSWORD = /^Password\b/;
const CONFIRM = /^Konfirmasi Password/;
const NAME = /^Nama Lengkap/;

async function fillLogin(user: ReturnType<typeof renderWithProviders>['user'], email: string, password: string) {
  await user.type(screen.getByLabelText(EMAIL), email);
  await user.type(screen.getByLabelText(PASSWORD), password);
  await user.click(screen.getByRole('button', { name: 'Masuk' }));
}

describe('LoginPage', () => {
  it('menolak submit kosong dengan pesan validasi per field', async () => {
    const { user } = renderWithProviders(<LoginPage />, { route: '/login' });
    await user.click(screen.getByRole('button', { name: 'Masuk' }));
    const alerts = await screen.findAllByRole('alert');
    // Email kosong kena aturan format lebih dulu; password kosong dilaporkan sebagai wajib diisi.
    expect(alerts.map((el) => el.textContent)).toEqual(['Format email tidak valid', 'Wajib diisi']);
  });

  it('menandai format email yang salah sebelum menyentuh server', async () => {
    const { user } = renderWithProviders(<LoginPage />, { route: '/login' });
    await user.type(screen.getByLabelText(EMAIL), 'bukan-email');
    await user.tab();
    expect(await screen.findByText('Format email tidak valid')).toBeInTheDocument();
  });

  it('menampilkan pesan SKPL bila kredensial salah', async () => {
    const { user } = renderWithProviders(<LoginPage />, { route: '/login' });
    await fillLogin(user, db.user.email, 'passwordsalah1');
    expect(await screen.findByText('Email atau password tidak valid')).toBeInTheDocument();
  });

  it('masuk sukses -> pengumuman sesi + toast', async () => {
    const { user } = renderWithProviders(<LoginPage />, { route: '/login' });
    await fillLogin(user, db.user.email, TEST_PASSWORD);
    expect(await screen.findByText('Berhasil masuk')).toBeInTheDocument();
  });

  it('menghormati Retry-After saat terkena rate limit', async () => {
    server.use(
      http.post(`${API_BASE}/auth/login`, () =>
        HttpResponse.json(
          { error: { code: 'RATE_LIMITED', message: 'Terlalu banyak percobaan' } },
          { status: 429, headers: { 'Retry-After': '120' } },
        ),
      ),
    );
    const { user } = renderWithProviders(<LoginPage />, { route: '/login' });
    await fillLogin(user, db.user.email, TEST_PASSWORD);
    expect(await screen.findByText('Terlalu banyak percobaan. Coba lagi dalam 2 menit.')).toBeInTheDocument();
  });
});

describe('RegisterPage', () => {
  async function fillRegister(user: ReturnType<typeof renderWithProviders>['user'], email: string, password: string, confirm = password) {
    await user.type(screen.getByLabelText(NAME), 'Budi Siswa');
    await user.type(screen.getByLabelText(EMAIL), email);
    await user.type(screen.getByLabelText(PASSWORD), password);
    await user.type(screen.getByLabelText(CONFIRM), confirm);
    await user.click(screen.getByRole('button', { name: 'Daftar' }));
  }

  it('meminta konfirmasi password yang sama', async () => {
    const { user } = renderWithProviders(<RegisterPage />, { route: '/register' });
    await fillRegister(user, 'budi2@example.test', TEST_PASSWORD, 'PasswordKuat2');
    expect(await screen.findByText('Konfirmasi password tidak sama')).toBeInTheDocument();
  });

  it('menolak password kurang dari 8 karakter', async () => {
    const { user } = renderWithProviders(<RegisterPage />, { route: '/register' });
    await fillRegister(user, 'budi3@example.test', 'Ab1');
    expect(await screen.findByText('Password minimal 8 karakter')).toBeInTheDocument();
  });

  it('menandai email yang sudah terdaftar dari jawaban 409 server', async () => {
    server.use(
      http.post(`${API_BASE}/auth/register`, () =>
        HttpResponse.json({ error: { code: 'EMAIL_TAKEN', message: 'Email sudah terdaftar' } }, { status: 409 }),
      ),
    );
    const { user } = renderWithProviders(<RegisterPage />, { route: '/register' });
    await fillRegister(user, db.user.email, TEST_PASSWORD);
    expect(await screen.findByText('Email sudah terdaftar')).toBeInTheDocument();
  });

  it('daftar sukses -> sesi diumumkan dan sambutan tampil', async () => {
    const { user } = renderWithProviders(<RegisterPage />, { route: '/register' });
    await fillRegister(user, 'sari@example.test', TEST_PASSWORD);
    expect(await screen.findByText('Selamat datang di StudyWork Planner!')).toBeInTheDocument();
  });

  it('indikator kekuatan password naik bertahap (tidak memblokir)', () => {
    expect(passwordStrength('abc')).toBe(0);
    expect(passwordStrength('abcdefgh')).toBe(1);
    expect(passwordStrength('Abcdefgh')).toBe(2);
    expect(passwordStrength('Abcdefgh1')).toBe(3);
  });
});

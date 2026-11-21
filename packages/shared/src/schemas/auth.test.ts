import { describe, expect, it } from 'vitest';
import { registerSchema, USER_PATTERNS } from './auth.js';

const validPayload = {
  name: 'Siti Nur Aisyah',
  email: 'siti@example.com',
  password: 'Contoh123',
  confirmPassword: 'Contoh123',
};

describe('registerSchema validasi format input', () => {
  it('menerima seluruh input valid (termasuk tanda baca nama yang wajar)', () => {
    expect(registerSchema.safeParse(validPayload).success).toBe(true);
    expect(registerSchema.safeParse({ ...validPayload, name: "O'Connor-Putra" }).success).toBe(true);
    expect(registerSchema.safeParse({ ...validPayload, name: 'M.Fauzi' }).success).toBe(true);
  });

  it('menolak nama dengan angka atau karakter berbahaya', () => {
    for (const badName of ['Budi123', '<script>alert(1)</script>', '   ']) {
      const res = registerSchema.safeParse({ ...validPayload, name: badName });
      expect(res.success, badName).toBe(false);
    }
  });

  it('menolak format email tidak lengkap dan menerima email valid', () => {
    expect(registerSchema.safeParse({ ...validPayload, email: 'andi@gmail' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...validPayload, email: 'andi@example.com' }).success).toBe(true);
  });

  it('menolak password lemah (tanpa huruf besar/kecil/angka atau mengandung spasi)', () => {
    for (const badPassword of ['password', 'PASSWORD1', 'Password', 'Contoh 123', 'Ab1']) {
      const res = registerSchema.safeParse({ ...validPayload, password: badPassword, confirmPassword: badPassword });
      expect(res.success, badPassword).toBe(false);
    }
  });

  it('menolak konfirmasi password yang berbeda', () => {
    const res = registerSchema.safeParse({ ...validPayload, password: 'Contoh123', confirmPassword: 'Beda123' });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0]?.message).toBe('password_mismatch');
    }
  });

  it('pola USER_PATTERNS dapat diuji langsung dengan .test()', () => {
    expect(USER_PATTERNS.name.test('Siti Nur Aisyah')).toBe(true);
    expect(USER_PATTERNS.name.test('Budi123')).toBe(false);
    expect(USER_PATTERNS.email.test('andi@example.com')).toBe(true);
    expect(USER_PATTERNS.email.test('andi@gmail')).toBe(false);
    expect(USER_PATTERNS.password.test('Contoh123')).toBe(true);
    expect(USER_PATTERNS.password.test('password')).toBe(false);
  });
});

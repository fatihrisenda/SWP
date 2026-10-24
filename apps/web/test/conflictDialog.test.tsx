/** Uji dialog konflik (Issue 046/061): isi daftar, tombol aksi, dan galat pengecekan. */
import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConflictDialog } from '../src/components/ConflictDialog';
import type { ConflictDialogProps } from '../src/components/ConflictDialog';
import { makeConflicts, makeOpponent } from './factories';
import { renderWithProviders } from './utils';

const NOOP = {
  onRetry: vi.fn(),
  onUseSuggestion: vi.fn(),
  onAdjust: vi.fn(),
  onDeleteLowPriority: vi.fn(),
  onSaveAnyway: vi.fn(),
};

type Extras = Partial<Omit<ConflictDialogProps, 'result' | 'timezone' | 'locale'>>;

function setup(result: ConflictDialogProps['result'], extra: Extras = {}) {
  const view = renderWithProviders(
    <ConflictDialog {...NOOP} {...extra} result={result} timezone="Asia/Jakarta" locale="id" />,
  );
  return { ...view, dialog: screen.getByRole('dialog', { name: 'Konflik Jadwal Terdeteksi' }) };
}

describe('ConflictDialog', () => {
  it('menyebutkan bentrok, jeda sempit, dan beban harian', () => {
    const { dialog } = setup(
      makeConflicts({
        any: true,
        collisions: [{ task: makeOpponent({ title: 'Meeting dosen' }), start: '2026-10-25T09:00:00.000Z', end: '2026-10-25T10:00:00.000Z' }],
        buffers: [
          {
            task: makeOpponent({ id: 'task-y', title: 'Kuliah Bahasa Inggris' }),
            gapMinutes: 12,
            start: '2026-10-25T11:00:00.000Z',
            end: '2026-10-25T12:00:00.000Z',
          },
        ],
        overload: [{ dayStart: '2026-10-25T00:00:00.000Z', hours: 11 }],
      }),
    );
    expect(within(dialog).getByText(/Bentrok dengan "Meeting dosen"/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Jeda dengan "Kuliah Bahasa Inggris" hanya 12 menit/)).toBeInTheDocument();
    expect(within(dialog).getByText(/melebihi kapasitas harian Anda/)).toBeInTheDocument();
  });

  it('menawarkan saran, hapus prioritas rendah, dan tetap simpan', async () => {
    const onUseSuggestion = vi.fn();
    const onDeleteLowPriority = vi.fn();
    const onSaveAnyway = vi.fn();
    const { dialog, user } = setup(
      makeConflicts({
        any: true,
        collisions: [{ task: makeOpponent(), start: '2026-10-25T09:00:00.000Z', end: '2026-10-25T10:00:00.000Z' }],
        suggestedSlot: { start: '2026-10-25T15:00:00.000Z', end: '2026-10-25T16:30:00.000Z' },
        lowPriorityCandidate: makeOpponent({ id: 'task-z', title: 'Nonton series' }),
      }),
      { onUseSuggestion, onDeleteLowPriority, onSaveAnyway },
    );
    await user.click(within(dialog).getByRole('button', { name: /^Pakai jadwal saran/ }));
    expect(onUseSuggestion).toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Hapus tugas "Nonton series" (Prioritas Rendah)' }));
    expect(onDeleteLowPriority).toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Tetap Simpan' }));
    expect(onSaveAnyway).toHaveBeenCalled();
    expect(within(dialog).getByText(/Bentrok dengan "Meeting dosen"/)).toBeInTheDocument();
  });

  it('menyembunyikan tombol saran dan hapus bila tidak ada opsinya', () => {
    const { dialog } = setup(
      makeConflicts({
        any: true,
        collisions: [{ task: makeOpponent(), start: '2026-10-25T09:00:00.000Z', end: '2026-10-25T10:00:00.000Z' }],
      }),
    );
    expect(within(dialog).queryByRole('button', { name: /^Pakai jadwal saran/ })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /^Hapus tugas/ })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Atur Ulang Jadwal' })).toBeInTheDocument();
  });

  it('menampilkan pesan galat + tombol coba lagi tanpa menutup dialog', async () => {
    const onRetry = vi.fn();
    const { dialog, user } = setup(makeConflicts({ any: false }), { onRetry, error: 'Pengecekan konflik gagal. Periksa koneksi lalu coba lagi.' });
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Pengecekan konflik gagal');
    await user.click(within(dialog).getByRole('button', { name: 'Coba lagi' }));
    expect(onRetry).toHaveBeenCalled();
    expect(dialog).toBeInTheDocument();
  });

  it('memperingatkan bila batas pakai saran tercapai', () => {
    const { dialog } = setup(makeConflicts({ any: true }), { maxRechecksReached: true });
    expect(within(dialog).getByText('Jadwal saran sudah dipakai 3 kali berturut-turut. Atur waktu secara manual.')).toBeInTheDocument();
  });
});

/** Uji form tugas (Issue 045/061): field dinamis per tipe, validasi, pratinjau prioritas, alur konflik. */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskForm } from '../src/components/TaskForm';
import { API_BASE } from '../src/lib/api';
import type { CategoryDto, TaskDto } from '../src/lib/dto';
import { CATEGORY_ID, makeCategory, makeConflicts, makeOpponent, makeTask } from './factories';
import { server } from './server';
import { renderWithProviders } from './utils';

const TITLE = /^Judul Tugas/;
const TYPE = /^Tipe Tugas/;
const CATEGORY = /^Kategori Tugas/;
const DURATION = /^Estimasi Durasi Pengerjaan/;
const ROUTINE_START = /^Jam Mulai/;

const CATEGORIES: CategoryDto[] = [
  makeCategory(),
  makeCategory({ id: CATEGORY_ID.olahraga, name: 'Olahraga', color: '#16A34A', type: 'PRIBADI' }),
];

function setup(props: Partial<{ mode: 'create' | 'edit'; initial: TaskDto; defaultCategoryId: string }> = {}) {
  const onSaved = vi.fn();
  const onCancel = vi.fn();
  const onManageCategories = vi.fn();
  const view = renderWithProviders(
    <TaskForm
      mode={props.mode ?? 'create'}
      initial={props.initial}
      categories={CATEGORIES}
      timezone="Asia/Jakarta"
      userId="user-1"
      defaultCategoryId={props.defaultCategoryId}
      onCancel={onCancel}
      onManageCategories={onManageCategories}
      onSaved={onSaved}
    />,
  );
  return { ...view, onSaved, onCancel, onManageCategories };
}

/** Isi field wajib untuk tipe Deadline (tanggalnya sudah terisi bawaan). */
async function fillDeadline(user: ReturnType<typeof setup>['user'], title = 'Belajar UTS') {
  await user.type(screen.getByLabelText(TITLE), title);
  await user.selectOptions(screen.getByLabelText(TYPE), 'DEADLINE');
  await user.selectOptions(screen.getByRole('combobox', { name: CATEGORY }), CATEGORIES[0]?.id ?? '');
}

describe('TaskForm', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('meminta judul dan kategori sebelum mengirim apa pun', async () => {
    const { user, onSaved } = setup();
    await user.selectOptions(screen.getByRole('combobox', { name: CATEGORY }), '');
    await user.click(screen.getByRole('button', { name: 'Tambah Tugas' }));
    expect(await screen.findByText('Judul wajib diisi')).toBeInTheDocument();
    expect(await screen.findByText('Pilih kategori terlebih dahulu.')).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
    // Fokus dipindah ke field error pertama (Issue 045 langkah 4).
    expect(screen.getByLabelText(TITLE)).toHaveFocus();
  });

  it('menampilkan field waktu sesuai tipe tugas', async () => {
    const { user } = setup();
    expect(screen.getByLabelText('Waktu Mulai — tanggal')).toBeInTheDocument();
    expect(screen.getByLabelText('Waktu Selesai — tanggal')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(TYPE), 'DEADLINE');
    expect(screen.getByLabelText('Deadline — tanggal')).toBeInTheDocument();
    expect(screen.getByLabelText(DURATION)).toBeInTheDocument();
    expect(screen.queryByLabelText('Waktu Mulai — tanggal')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(TYPE), 'ROUTINE');
    expect(screen.getByText('Hari Rutin')).toBeInTheDocument();
    expect(screen.getByLabelText('Senin')).toBeInTheDocument();
    expect(screen.getByLabelText(ROUTINE_START)).toBeInTheDocument();
  });

  it('memperkirakan prioritas setelah data lengkap', async () => {
    const { user } = setup();
    expect(screen.getByText('Lengkapi kategori dan waktu untuk melihat perkiraan prioritas.')).toBeInTheDocument();
    await fillDeadline(user);
    expect(await screen.findByTestId('priority-preview')).toHaveTextContent(/Prioritas (Utama|Tinggi|Sedang|Rendah)/);
  });

  it('menyimpan tugas baru dan memanggil onSaved', async () => {
    const { user, onSaved } = setup();
    await fillDeadline(user, 'Belajar UTS');
    await user.click(screen.getByRole('button', { name: 'Tambah Tugas' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(onSaved.mock.calls[0]?.[0]).toMatchObject({ title: 'Belajar UTS' });
  });

  it('menampilkan dialog konflik dan tetap menyimpan lewat "Tetap Simpan"', async () => {
    let checks = 0;
    server.use(
      http.post(`${API_BASE}/tasks/conflicts`, () => {
        checks += 1;
        return HttpResponse.json(
          checks === 1
            ? makeConflicts({
                any: true,
                collisions: [{ task: makeOpponent({ title: 'Meeting dosen' }), start: '2026-10-26T09:00:00.000Z', end: '2026-10-26T10:00:00.000Z' }],
                suggestedSlot: { start: '2026-10-26T15:00:00.000Z', end: '2026-10-26T16:30:00.000Z' },
                lowPriorityCandidate: makeOpponent({ id: 'task-z', title: 'Nonton series' }),
              })
            : makeConflicts(),
        );
      }),
    );
    const { user, onSaved } = setup();
    await fillDeadline(user);
    await user.click(screen.getByRole('button', { name: 'Tambah Tugas' }));

    const dialog = await screen.findByRole('dialog', { name: 'Konflik Jadwal Terdeteksi' });
    expect(within(dialog).getByText(/Bentrok dengan "Meeting dosen"/)).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Tetap Simpan' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it('memakai jadwal saran lalu menutup dialog saat cek ulang bersih', async () => {
    let checks = 0;
    server.use(
      http.post(`${API_BASE}/tasks/conflicts`, () => {
        checks += 1;
        return HttpResponse.json(
          checks === 1
            ? makeConflicts({
                any: true,
                collisions: [{ task: makeOpponent(), start: '2026-10-25T09:00:00.000Z', end: '2026-10-25T10:00:00.000Z' }],
                suggestedSlot: { start: '2026-10-26T15:00:00.000Z', end: '2026-10-26T16:30:00.000Z' },
              })
            : makeConflicts(),
        );
      }),
    );
    const { user, onSaved } = setup();
    await user.type(screen.getByLabelText(TITLE), 'Belajar UTS');
    await user.selectOptions(screen.getByRole('combobox', { name: CATEGORY }), CATEGORIES[0]?.id ?? '');
    fireEvent.change(screen.getByLabelText('Waktu Mulai — tanggal'), { target: { value: '2026-10-25' } });
    fireEvent.change(screen.getByLabelText('Waktu Mulai — jam'), { target: { value: '09:00' } });
    fireEvent.change(screen.getByLabelText('Waktu Selesai — tanggal'), { target: { value: '2026-10-25' } });
    fireEvent.change(screen.getByLabelText('Waktu Selesai — jam'), { target: { value: '10:00' } });
    await user.click(screen.getByRole('button', { name: 'Tambah Tugas' }));

    const dialog = await screen.findByRole('dialog', { name: 'Konflik Jadwal Terdeteksi' });
    await user.click(within(dialog).getByRole('button', { name: /^Pakai jadwal saran/ }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Konflik Jadwal Terdeteksi' })).not.toBeInTheDocument());
    expect(checks).toBe(2);
    expect(onSaved).not.toHaveBeenCalled();
    // Slot saran (15:00Z = 22:00 WIB) tertulis ke field waktu.
    expect(screen.getByLabelText('Waktu Mulai — tanggal')).toHaveValue('2026-10-26');
    expect(screen.getByLabelText('Waktu Mulai — jam')).toHaveValue('22:00');

    // Simpan lagi dengan waktu saran -> tidak ada konflik -> tersimpan.
    await user.click(screen.getByRole('button', { name: 'Tambah Tugas' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it('menanyakan konfirmasi bila ada perubahan yang belum disimpan', async () => {
    const { user, onCancel } = setup();
    await user.type(screen.getByLabelText(TITLE), 'Draf');
    await user.click(screen.getByRole('button', { name: 'Batal' }));
    const ask = await screen.findByRole('alertdialog');
    expect(within(ask).getByText('Perubahan yang belum disimpan akan hilang.')).toBeInTheDocument();
    await user.click(within(ask).getByRole('button', { name: 'Tinggalkan' }));
    await waitFor(() => expect(onCancel).toHaveBeenCalled());
  });

  it('memuat nilai tugas saat mode edit', () => {
    setup({ mode: 'edit', initial: makeTask({ title: 'Quiz Diskrit', type: 'DEADLINE' }) });
    expect(screen.getByDisplayValue('Quiz Diskrit')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Simpan Perubahan' })).toBeInTheDocument();
  });
});

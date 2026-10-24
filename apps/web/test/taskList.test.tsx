/** Uji daftar tugas (Issue 061): render item, filter tanpa reload, state kosong, muat lebih banyak. */
import { useState } from 'react';
import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TaskList } from '../src/components/TaskList';
import { DEFAULT_TASK_QUERY, type TaskListQuery } from '../src/lib/taskQuery';
import { makeTask } from './factories';
import { renderWithProviders } from './utils';

function setup(overrides: Partial<TaskListQuery> & { tasks?: ReturnType<typeof makeTask>[]; total?: number } = {}) {
  const { tasks = [], total, ...queryPatch } = overrides;
  const initialQuery: TaskListQuery = { ...DEFAULT_TASK_QUERY, ...queryPatch };
  const props = {
    tasks,
    total: total ?? tasks.length,
    onQueryChange: vi.fn(),
    onToggleStatus: vi.fn(),
    onOpen: vi.fn(),
    onCreate: vi.fn(),
    onLoadMore: vi.fn(),
  };
  // `TaskList` terkontrol penuh (seperti di halaman), jadi uji memakai harness yang
  // menerapkan patch query ke state, sama seperti induk aslinya.
  function Harness() {
    const [query, setQuery] = useState(initialQuery);
    return (
      <TaskList
        {...props}
        query={query}
        onQueryChange={(patch) => {
          props.onQueryChange(patch);
          setQuery((current) => ({ ...current, ...patch }));
        }}
      />
    );
  }
  const view = renderWithProviders(<Harness />);
  return { ...view, props };
}

describe('TaskList', () => {
  it('menampilkan judul, kategori, tipe, dan prioritas tiap tugas', () => {
    setup({ tasks: [makeTask()] });
    const item = screen.getByRole('listitem');
    expect(within(item).getByText('Quiz Matematika Diskrit')).toBeInTheDocument();
    expect(within(item).getByText('Quiz')).toBeInTheDocument();
    expect(within(item).getByText('Deadline')).toBeInTheDocument();
    expect(within(item).getByText(/Prioritas Tinggi/)).toBeInTheDocument();
  });

  it('meneruskan perubahan status dan pembukaan detail', async () => {
    const task = makeTask();
    const { props, user } = setup({ tasks: [task] });
    await user.click(screen.getByRole('checkbox'));
    expect(props.onToggleStatus).toHaveBeenCalledWith(task);
    await user.click(screen.getByRole('button', { name: 'Buka detail Quiz Matematika Diskrit' }));
    expect(props.onOpen).toHaveBeenCalledWith(task);
  });

  it('mengirim kata kunci ke URL query dan mereset offset', async () => {
    const { props, user } = setup({ tasks: [makeTask()], offset: 50 });
    await user.type(screen.getByRole('searchbox', { name: 'Cari tugas' }), 'kuis');
    expect(props.onQueryChange).toHaveBeenLastCalledWith({ q: 'kuis', offset: 0 });
  });

  it('mengganti filter status tanpa reload', async () => {
    const { props, user } = setup({ tasks: [makeTask()] });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'done');
    expect(props.onQueryChange).toHaveBeenLastCalledWith({ status: 'done', offset: 0 });
  });

  it('memakai pesan kosong khusus ketika filter sedang aktif', () => {
    setup({ tasks: [], q: 'kuis' });
    expect(screen.getByText('Belum ada tugas')).toBeInTheDocument();
    expect(screen.getByText('Tidak ada tugas yang cocok dengan filter')).toBeInTheDocument();
  });

  it('menawarkan muat lebih banyak bila masih ada sisa', async () => {
    const { props, user } = setup({ tasks: [makeTask()], total: 12 });
    const button = screen.getByRole('button', { name: 'Muat lebih banyak (1 dari 12)' });
    await user.click(button);
    expect(props.onLoadMore).toHaveBeenCalled();
  });
});

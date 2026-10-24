/** Uji checkbox tri-state (Issue 061): siklus TODO -> IN_PROGRESS -> DONE -> TODO + a11y. */
import { useState } from 'react';
import type { TaskStatus } from '@swp/shared';
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TriStateCheckbox } from '../src/components/ui/TriStateCheckbox';
import { renderWithProviders } from './utils';

/** State asli: komponen induk menyimpan status, sehingga siklus bisa diikuti sampai selesai. */
function Harness({ initial, onChange }: { initial: TaskStatus; onChange?: (next: TaskStatus) => void }) {
  const [status, setStatus] = useState<TaskStatus>(initial);
  return (
    <TriStateCheckbox
      status={status}
      taskTitle="Quiz Diskrit"
      onChange={(next) => {
        onChange?.(next);
        setStatus(next);
      }}
    />
  );
}

describe('TriStateCheckbox', () => {
  it('menempuh siklus penuh TODO -> IN_PROGRESS -> DONE -> TODO', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(<Harness initial="TODO" onChange={onChange} />);
    const box = screen.getByRole('checkbox');

    await user.click(box);
    expect(onChange).toHaveBeenLastCalledWith('IN_PROGRESS');
    expect(box).toHaveAttribute('aria-checked', 'mixed');

    await user.click(box);
    expect(onChange).toHaveBeenLastCalledWith('DONE');
    expect(box).toHaveAttribute('aria-checked', 'true');

    await user.click(box);
    expect(onChange).toHaveBeenLastCalledWith('TODO');
    expect(box).toHaveAttribute('aria-checked', 'false');
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it('menyebutkan judul dan status saat ini pada label aksesibel', () => {
    renderWithProviders(<Harness initial="IN_PROGRESS" />);
    expect(screen.getByRole('checkbox')).toHaveAccessibleName('Ubah status tugas Quiz Diskrit, saat ini Sedang');
  });
});

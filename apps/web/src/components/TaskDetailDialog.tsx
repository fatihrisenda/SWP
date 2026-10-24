import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth';
import { useConfirm } from '../lib/confirm';
import { useDeleteTask } from '../lib/mutations';
import { useTask } from '../lib/queries';
import { TaskDetailModal } from './TaskDetailModal';
import { LoadingBlock, ErrorBlock } from './AppLayout';
import { useToast } from './Toast';

/**
 * Popup detail tugas (Issue 044 langkah 4) untuk halaman yang hanya memegang id
 * (dashboard & rekomendasi membawa DTO ringkas, bukan TaskDto lengkap).
 */
export function TaskDetailDialog({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const deleteTask = useDeleteTask();
  const task = useTask(taskId);

  if (task.isLoading) return <LoadingBlock />;
  if (task.isError || !task.data || !user) {
    return (
      <ErrorBlock
        message={t('errors.loadFailed')}
        onRetry={() => {
          void task.refetch();
        }}
      />
    );
  }

  const detail = task.data;
  const onDelete = async (): Promise<void> => {
    const ok = await confirm({
      title: t('tasks.delete.confirmTitle'),
      text: t('tasks.delete.confirm'),
      okLabel: t('common.confirm'),
      danger: true,
    });
    if (!ok) return;
    await deleteTask.mutateAsync(detail.id);
    toast.success(t('tasks.deleted'));
    window.history.back();
    onClose();
  };

  return (
    <TaskDetailModal
      task={detail}
      timezone={user.timezone}
      locale={user.locale}
      onClose={onClose}
      onEdit={() => {
        onClose();
        navigate(`/tugas/${detail.id}/edit`, { replace: true });
      }}
      onDelete={() => void onDelete()}
    />
  );
}

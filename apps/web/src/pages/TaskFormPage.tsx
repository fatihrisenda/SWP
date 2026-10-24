/** UISW09 form tambah/edit tugas (Issue 045 langkah 12): halaman penuh < 768 px, modal >= 768 px (D-35). */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Tags } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CategoryDto, TaskDto } from '../lib/dto';
import { useAuth } from '../lib/auth';
import { useIsDesktop } from '../lib/hooks';
import { useCategories, useTask } from '../lib/queries';
import { ApiError } from '../lib/api';
import { ErrorBlock, LoadingBlock, PageHeader } from '../components/AppLayout';
import { TaskForm } from '../components/TaskForm';
import { useToast } from '../components/Toast';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';

export interface TaskFormPageProps {
  mode: 'create' | 'edit';
}

export function TaskFormPage({ mode }: TaskFormPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const isDesktop = useIsDesktop();
  const params = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const scopeParam = searchParams.get('scope');
  const categoryIdParam = searchParams.get('category');

  const categoriesQuery = useCategories();
  const taskQuery = useTask(mode === 'edit' ? params.id : undefined, mode === 'edit');
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (mode !== 'edit') return;
    if (taskQuery.isError) {
      setNotFound(true);
      toast.error(taskQuery.error instanceof ApiError ? taskQuery.error.message : t('errors.loadFailed'));
      const timer = window.setTimeout(() => navigate('/tugas-kuliah', { replace: true }), 1200);
      return () => window.clearTimeout(timer);
    }
  }, [mode, taskQuery.isError, taskQuery.error, taskQuery.refetch, navigate, toast, t]);

  const categories = categoriesQuery.data ?? [];
  const defaultCategoryId = useMemo(() => {
    if (categoryIdParam) return categoryIdParam;
    if (scopeParam === 'kuliah' || scopeParam === 'pribadi') {
      return categories.find((category) => category.type === (scopeParam === 'kuliah' ? 'KULIAH' : 'PRIBADI'))?.id;
    }
    return categories[0]?.id;
  }, [categoryIdParam, scopeParam, categories]);

  const goBack = (): void => {
    navigate(-1);
  };

  const onSaved = (saved: TaskDto): void => {
    toast.success(t(mode === 'edit' ? 'tasks.form.updated' : 'tasks.form.created'));
    const target = saved.category.type === 'KULIAH' ? '/tugas-kuliah' : '/tugas-pribadi';
    navigate(target, { replace: true });
  };

  if (categoriesQuery.isLoading || (mode === 'edit' && (taskQuery.isLoading || notFound))) {
    return <LoadingBlock />;
  }

  if (categoriesQuery.isError) {
    return <ErrorBlock onRetry={() => void categoriesQuery.refetch()} />;
  }

  const body =
    categories.length === 0 ? (
      <EmptyState
        icon={Tags}
        title={t('categories.emptyTitle')}
        description={t('categories.emptyBody')}
        action={
          <Button icon={<Tags aria-hidden="true" size={18} />} onClick={() => navigate('/kategori')}>
            {t('categories.addTitle')}
          </Button>
        }
      />
    ) : (
      <TaskForm
        mode={mode}
        initial={mode === 'edit' ? (taskQuery.data as TaskDto | undefined) : undefined}
        categories={categories as CategoryDto[]}
        timezone={user?.timezone ?? 'Asia/Jakarta'}
        userId={user?.id}
        onCancel={goBack}
        onManageCategories={() => navigate('/kategori')}
        onSaved={onSaved}
        defaultCategoryId={defaultCategoryId}
      />
    );

  if (isDesktop && mode === 'create') {
    return (
      <Modal open onClose={goBack} title={t('tasks.form.add')} size="lg" sticky>
        {body}
      </Modal>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t(mode === 'edit' ? 'tasks.form.edit' : 'tasks.form.add')}
        subtitle={t('tasks.form.requiredHint')}
      />
      {body}
    </div>
  );
}

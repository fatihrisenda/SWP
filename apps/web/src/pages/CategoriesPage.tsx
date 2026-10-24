/** UISW07 Kategori Tugas (Issue 048): dua panel (Kuliah/Pribadi), tabel semantik, tambah/edit/hapus + pindahkan tugas. */
import { useState } from 'react';
import { Plus, Tags } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CategoryType } from '@swp/shared';
import { useConfirm } from '../lib/confirm';
import { useCategories } from '../lib/queries';
import { useCreateCategory, useDeleteCategory, useUpdateCategory } from '../lib/mutations';
import { ApiError } from '../lib/api';
import type { CategoryDto } from '../lib/dto';
import { ErrorBlock, LoadingBlock, PageHeader } from '../components/AppLayout';
import { CategoryFormModal } from '../components/CategoryFormModal';
import { useToast } from '../components/Toast';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { DropdownMenu } from '../components/ui/DropdownMenu';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { Select } from '../components/ui/Select';

export function CategoriesPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
  const categories = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const [formFor, setFormFor] = useState<{ mode: 'create' } | { mode: 'edit'; category: CategoryDto } | null>(null);
  const [reassign, setReassign] = useState<CategoryDto | null>(null);

  const items = categories.data ?? [];

  const save = async (values: { name: string; color: string; type: CategoryType }): Promise<void> => {
    if (!formFor) return;
    if (formFor.mode === 'edit') {
      const current = formFor.category;
      const count = current.taskCount ?? 0;
      if (values.type !== current.type && count > 0) {
        const ok = await confirm({
          title: t('categories.changeType.title'),
          text: t('categories.changeType.body', { count, page: t(`categoryType.${values.type}`) }),
          okLabel: t('common.confirm'),
        });
        if (!ok) return;
      }
      await updateCategory.mutateAsync({ id: current.id, body: values });
      toast.success(t('categories.updated'));
    } else {
      await createCategory.mutateAsync(values);
      toast.success(t('categories.created'));
    }
    setFormFor(null);
  };

  const askDelete = async (category: CategoryDto): Promise<void> => {
    const ok = await confirm({
      title: t('categories.delete.title'),
      text: t('categories.delete.confirm'),
      okLabel: t('common.confirm'),
      danger: true,
    });
    if (!ok) return;
    if ((category.taskCount ?? 0) > 0) {
      setReassign(category);
      return;
    }
    await removeCategory(category.id);
  };

  const removeCategory = async (id: string): Promise<void> => {
    try {
      await deleteCategory.mutateAsync({ id });
      toast.success(t('categories.deleted'));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CATEGORY_IN_USE') toast.error(t('categories.inUse'));
      else toast.error(t('errors.generic'));
    }
  };

  if (categories.isLoading) return <LoadingBlock />;
  if (categories.isError) return <ErrorBlock onRetry={() => void categories.refetch()} />;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('nav.categories')}
        subtitle={t('categories.subtitle')}
        actions={
          <Button icon={<Plus aria-hidden="true" size={18} />} onClick={() => setFormFor({ mode: 'create' })}>
            {t('categories.add')}
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <CategoryTable categories={items.filter((item) => item.type === 'KULIAH')} type="KULIAH" onEdit={(category) => setFormFor({ mode: 'edit', category })} onDelete={(category) => void askDelete(category)} />
        <CategoryTable categories={items.filter((item) => item.type === 'PRIBADI')} type="PRIBADI" onEdit={(category) => setFormFor({ mode: 'edit', category })} onDelete={(category) => void askDelete(category)} />
      </div>

      {formFor ? (
        <CategoryFormModal
          initial={formFor.mode === 'edit' ? formFor.category : undefined}
          onClose={() => setFormFor(null)}
          onSubmit={async (values) => {
            try {
              await save(values);
            } catch (err) {
              if (err instanceof ApiError) throw err;
              toast.error(t('errors.generic'));
            }
          }}
        />
      ) : null}

      {reassign ? (
        <ReassignModal
          category={reassign}
          candidates={items.filter((item) => item.id !== reassign.id && item.type === reassign.type)}
          onClose={() => setReassign(null)}
          onConfirm={async (targetId) => {
            try {
              await deleteCategory.mutateAsync({ id: reassign.id, reassignTo: targetId });
              toast.success(t('categories.deleted'));
              setReassign(null);
            } catch {
              toast.error(t('errors.generic'));
            }
          }}
        />
      ) : null}
    </div>
  );
}

function CategoryTable({
  categories,
  type,
  onEdit,
  onDelete,
}: {
  categories: CategoryDto[];
  type: CategoryType;
  onEdit: (category: CategoryDto) => void;
  onDelete: (category: CategoryDto) => void;
}) {
  const { t } = useTranslation();
  return (
    <Card as="section" ariaLabel={t(`categoryType.${type}`)} className="flex flex-col gap-3 p-4">
      <h2 className="text-h2 font-bold">{t(`categoryType.${type}`)}</h2>
      {categories.length === 0 ? (
        <EmptyState icon={Tags} title={t('categories.empty')} description={t('categories.emptyHint')} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-label">
            <caption className="sr-only">{t(`categoryType.${type}`)}</caption>
            <thead>
              <tr className="border-b border-line text-badge uppercase tracking-wide text-muted">
                <th scope="col" className="py-2 pr-2">
                  {t('categories.color')}
                </th>
                <th scope="col" className="py-2 pr-2">
                  {t('categories.name')}
                </th>
                <th scope="col" className="py-2 pr-2">
                  {t('categories.type')}
                </th>
                <th scope="col" className="py-2">
                  <span className="sr-only">{t('categories.actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id} className="border-b border-line last:border-0">
                  <td className="py-2 pr-2">
                    <span
                      className="inline-block h-5 w-5 rounded-pill border border-line"
                      style={{ backgroundColor: category.color }}
                      aria-hidden="true"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <span className="break-words font-semibold">{category.name}</span>
                    <span className="ml-1 text-badge text-muted">{category.taskCount ?? 0}</span>
                  </td>
                  <td className="py-2 pr-2 text-muted">{t(`categoryType.${category.type}`)}</td>
                  <td className="py-2 text-right">
                    <DropdownMenu
                      label={category.name}
                      items={[
                        { id: 'edit', label: t('categories.edit'), onSelect: () => onEdit(category) },
                        { id: 'delete', label: t('common.delete'), onSelect: () => onDelete(category), danger: true },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function ReassignModal({
  category,
  candidates,
  onClose,
  onConfirm,
}: {
  category: CategoryDto;
  candidates: CategoryDto[];
  onClose: () => void;
  onConfirm: (targetId: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [target, setTarget] = useState(candidates[0]?.id ?? '');

  return (
    <Modal
      open
      onClose={onClose}
      title={t('categories.reassign.title')}
      description={t('categories.reassign.body', { count: category.taskCount ?? 0, name: category.name })}
      testId="category-reassign"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            disabled={!target}
            onClick={() => {
              if (target) void onConfirm(target);
            }}
          >
            {t('common.delete')}
          </Button>
        </>
      }
    >
      {candidates.length === 0 ? (
        <p className="text-label text-muted">{t('categories.reassign.none')}</p>
      ) : (
        <label className="flex flex-col gap-1 text-badge font-semibold text-muted">
          {t('categories.reassign.pick')}
          <Select aria-label={t('categories.reassign.pick')} value={target} onChange={(event) => setTarget(event.target.value)}>
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </Select>
        </label>
      )}
    </Modal>
  );
}

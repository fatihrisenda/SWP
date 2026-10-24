/** UISW08 Admin Panel (Issue 049): statistik, pencarian, tabel user, tambah/edit/hapus dengan guard SuperAdmin terakhir. */
import { useState } from 'react';
import { LayoutDashboard, Pencil, Plus, Trash2, UserCheck, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth';
import { useConfirm } from '../lib/confirm';
import { ApiError } from '../lib/api';
import { useDebouncedValue } from '../lib/hooks';
import { fmtDateTime } from '../lib/format';
import { useAdminStats, useAdminUsers } from '../lib/queries';
import { useAdminCreateUser, useAdminDeleteUser, useAdminUpdateUser } from '../lib/mutations';
import type { AdminUserDto } from '../lib/dto';
import { ErrorBlock, LoadingBlock, PageHeader } from '../components/AppLayout';
import { AdminUserModal } from '../components/AdminUserModal';
import { useToast } from '../components/Toast';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { StatCard } from '../components/ui/StatCard';

const PAGE_SIZE = 50;

export function AdminPage() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();

  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [modal, setModal] = useState<{ mode: 'create' } | { mode: 'edit'; target: AdminUserDto } | null>(null);

  const query = useDebouncedValue(search, 300);
  const stats = useAdminStats();
  const list = useAdminUsers(query, offset);
  const createUser = useAdminCreateUser();
  const updateUser = useAdminUpdateUser();
  const deleteUser = useAdminDeleteUser();

  const rows = list.data ?? [];

  const reportError = (err: unknown): void => {
    if (err instanceof ApiError && err.code === 'LAST_SUPERADMIN') toast.error(t('admin.lastSuperAdmin'));
    else if (err instanceof ApiError && err.code === 'EMAIL_TAKEN') toast.error(t('admin.emailTaken'));
    else toast.error(t('errors.generic'));
  };

  const submit = async (values: Record<string, unknown>): Promise<void> => {
    try {
      if (modal?.mode === 'edit') {
        await updateUser.mutateAsync({ id: modal.target.id, body: values });
        toast.success(t('admin.userUpdated'));
      } else {
        await createUser.mutateAsync(values as { name: string; email: string; password: string; role: string });
        toast.success(t('admin.userCreated'));
      }
      setModal(null);
    } catch (err) {
      reportError(err);
      if (err instanceof ApiError) throw err;
    }
  };

  const remove = async (target: AdminUserDto): Promise<void> => {
    const ok = await confirm({
      title: t('admin.delete.title'),
      text: t('admin.delete.confirm'),
      okLabel: t('admin.delete.ok'),
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteUser.mutateAsync(target.id);
      toast.success(t('admin.userDeleted'));
    } catch (err) {
      reportError(err);
    }
  };

  if (stats.isLoading) return <LoadingBlock />;
  if (stats.isError || !stats.data) return <ErrorBlock onRetry={() => void stats.refetch()} />;

  const selfIsLastSuperAdmin = stats.data.totalSuperAdmin <= 1;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('nav.admin')}
        subtitle={t('admin.subtitle')}
        actions={
          <Button icon={<Plus aria-hidden="true" size={18} />} onClick={() => setModal({ mode: 'create' })}>
            {t('admin.add')}
          </Button>
        }
      />

      <section aria-label={t('admin.stats.title')} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icon={Users} label={t('admin.stats.total')} value={stats.data.totalUsers} />
        <StatCard icon={LayoutDashboard} label={t('admin.stats.mahasiswa')} value={stats.data.totalMahasiswa} tone="primary" />
        <StatCard icon={UserCheck} label={t('admin.stats.superadmin')} value={stats.data.totalSuperAdmin} />
      </section>

      <div className="relative">
        <Input
          type="search"
          aria-label={t('admin.search')}
          placeholder={t('admin.searchPlaceholder')}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setOffset(0);
          }}
        />
      </div>

      {list.isLoading ? (
        <LoadingBlock />
      ) : list.isError ? (
        <ErrorBlock onRetry={() => void list.refetch()} />
      ) : rows.length === 0 ? (
        <Card className="p-4 text-label text-muted">{t('admin.empty')}</Card>
      ) : (
        <>
          {/* Tabel di desktop, kartu di mobile (Issue 049). */}
          <Card as="section" ariaLabel={t('admin.list')} className="hidden overflow-x-auto p-4 lg:block">
            <table className="w-full border-collapse text-left text-label">
              <caption className="sr-only">{t('admin.list')}</caption>
              <thead>
                <tr className="border-b border-line text-badge uppercase tracking-wide text-muted">
                  <th scope="col">{t('admin.name')}</th>
                  <th scope="col">{t('admin.email')}</th>
                  <th scope="col">{t('admin.role')}</th>
                  <th scope="col">{t('admin.createdAt')}</th>
                  <th scope="col">
                    <span className="sr-only">{t('admin.actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-line last:border-0">
                    <td className="py-2 pr-2 font-semibold">
                      {row.name}
                      {row.id === user?.id ? <span className="ml-1 text-badge text-muted">{t('admin.you')}</span> : null}
                    </td>
                    <td className="py-2 pr-2 break-words text-muted">{row.email}</td>
                    <td className="py-2 pr-2">
                      <span className="badge bg-primary-light text-primary-dark">{t(`roles.${row.role}`)}</span>
                    </td>
                    <td className="py-2 pr-2 text-muted">{fmtDateTime(row.createdAt, user?.timezone ?? 'Asia/Jakarta', i18n.language)}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={t('admin.editFor', { name: row.name })}
                          onClick={() => setModal({ mode: 'edit', target: row })}
                        >
                          <Pencil aria-hidden="true" size={16} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={t('admin.deleteFor', { name: row.name })}
                          disabled={row.id === user?.id || (row.role === 'SUPERADMIN' && selfIsLastSuperAdmin)}
                          title={row.id === user?.id ? t('admin.cannotDeleteSelf') : selfIsLastSuperAdmin ? t('admin.lastSuperAdmin') : undefined}
                          onClick={() => void remove(row)}
                        >
                          <Trash2 aria-hidden="true" size={16} className="text-danger" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <ul className="flex flex-col gap-3 lg:hidden">
            {rows.map((row) => {
              const self = row.id === user?.id;
              return (
                <li key={row.id}>
                  <Card className="flex flex-col gap-2 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="break-words text-base font-semibold">
                          {row.name}
                          {self ? <span className="ml-1 text-badge text-muted">{t('admin.you')}</span> : null}
                        </p>
                        <p className="break-words text-badge text-muted">{row.email}</p>
                      </div>
                      <span className="badge shrink-0 bg-primary-light text-primary-dark">{t(`roles.${row.role}`)}</span>
                    </div>
                    <p className="text-badge text-muted">{fmtDateTime(row.createdAt, user?.timezone ?? 'Asia/Jakarta', i18n.language)}</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setModal({ mode: 'edit', target: row })}>
                        {t('common.edit')}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={self || (row.role === 'SUPERADMIN' && selfIsLastSuperAdmin)}
                        onClick={() => void remove(row)}
                      >
                        {t('common.delete')}
                      </Button>
                    </div>
                    {self ? <p className="text-badge text-muted">{t('admin.cannotDeleteSelf')}</p> : null}
                  </Card>
                </li>
              );
            })}
          </ul>

          {rows.length === PAGE_SIZE ? (
            <Button variant="secondary" block onClick={() => setOffset((value) => value + PAGE_SIZE)}>
              {t('common.loadMore', { shown: rows.length, total: offset + rows.length + 1 })}
            </Button>
          ) : null}
        </>
      )}

      {modal ? <AdminUserModal initial={modal.mode === 'edit' ? modal.target : undefined} onClose={() => setModal(null)} onSubmit={submit} /> : null}
    </div>
  );
}

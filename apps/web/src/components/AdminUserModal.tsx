import { useState } from 'react';
import { adminCreateUserSchema, adminUpdateUserSchema, type Role } from '@swp/shared';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../lib/api';
import type { AdminUserDto } from '../lib/dto';
import { messageForField, serverFieldErrors, zodFieldErrors, type FieldErrors } from '../lib/validation';
import { Button } from './ui/Button';
import { Field } from './ui/Field';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';
import { PasswordInput } from './ui/PasswordInput';
import { Select } from './ui/Select';

export interface AdminUserModalProps {
  initial?: AdminUserDto;
  onClose: () => void;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
}

/** Modal tambah/edit user admin (Issue 049). */
export function AdminUserModal({ initial, onClose, onSubmit }: AdminUserModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>(initial?.role ?? 'MAHASISWA');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const isCreate = !initial;

  const submit = async () => {
    const body: Record<string, unknown> = { name: name.trim(), email: email.trim(), role };
    if (password) body.password = password;
    const parsed = (isCreate ? adminCreateUserSchema : adminUpdateUserSchema).safeParse(
      isCreate ? { name: name.trim(), email: email.trim(), password, role } : { ...body, ...(password ? {} : { password: undefined }) },
    );
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error.issues));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await onSubmit(isCreate ? parsed.data : body);
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(serverFieldErrors(err.fields));
      else setErrors({ _root: err instanceof ApiError ? err.message : t('errors.network') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isCreate ? t('admin.addTitle') : t('admin.editTitle')}
      testId="admin-user-form"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void submit()} loading={busy} disabled={busy}>
            {isCreate ? t('common.save') : t('common.saveChanges')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={t('admin.name')} htmlFor="admin-name" required error={messageForField(errors, 'name', t)}>
          {({ id, invalid, describedBy }) => (
            <Input id={id} autoComplete="name" value={name} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(event) => setName(event.target.value)} />
          )}
        </Field>
        <Field label={t('admin.email')} htmlFor="admin-email" required error={messageForField(errors, 'email', t)}>
          {({ id, invalid, describedBy }) => (
            <Input id={id} type="email" inputMode="email" autoComplete="email" value={email} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(event) => setEmail(event.target.value)} />
          )}
        </Field>
        <Field
          label={t('admin.password')}
          htmlFor="admin-password"
          required={isCreate}
          hint={isCreate ? undefined : t('admin.passwordKeepHint')}
          error={messageForField(errors, 'password', t)}
        >
          {({ id, invalid, describedBy }) => (
            <PasswordInput
              id={id}
              autoComplete="new-password"
              value={password}
              placeholder={isCreate ? t('auth.register.passwordPlaceholder') : t('admin.passwordOptionalPlaceholder')}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
              onChange={(event) => setPassword(event.target.value)}
            />
          )}
        </Field>
        <Field label={t('admin.role')} htmlFor="admin-role" required>
          {({ id }) => (
            <Select id={id} value={role} onChange={(event) => setRole(event.target.value as Role)}>
              <option value="MAHASISWA">{t('roles.MAHASISWA')}</option>
              <option value="SUPERADMIN">{t('roles.SUPERADMIN')}</option>
            </Select>
          )}
        </Field>
        {errors._root ? (
          <p role="alert" className="text-label font-medium text-danger">
            {errors._root}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

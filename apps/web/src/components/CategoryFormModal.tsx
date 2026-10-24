import { useEffect, useState } from 'react';
import { categoryInputSchema, type CategoryType } from '@swp/shared';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../lib/api';
import type { CategoryDto } from '../lib/dto';
import { messageForField, serverFieldErrors, zodFieldErrors, type FieldErrors } from '../lib/validation';
import { Button } from './ui/Button';
import { ColorPicker, normalizeHex } from './ui/ColorPicker';
import { Field } from './ui/Field';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';
import { Select } from './ui/Select';

export interface CategoryFormModalProps {
  initial?: CategoryDto;
  onClose: () => void;
  onSubmit: (values: { name: string; color: string; type: CategoryType }) => Promise<void>;
}

const MAX_NAME = 50;

/** Modal tambah/edit kategori (Issue 048): nama + penghitung, warna, tipe. */
export function CategoryFormModal({ initial, onClose, onSubmit }: CategoryFormModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? '#2563EB');
  const [type, setType] = useState<CategoryType>(initial?.type ?? 'KULIAH');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(initial?.name ?? '');
    setColor(initial?.color ?? '#2563EB');
    setType(initial?.type ?? 'KULIAH');
    setErrors({});
  }, [initial]);

  const submit = async () => {
    const parsed = categoryInputSchema.safeParse({ name: name.trim(), color, type });
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error.issues));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await onSubmit(parsed.data);
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(serverFieldErrors(err.fields));
      else if (err instanceof ApiError && err.code === 'NAME_TAKEN') setErrors({ name: 'categories.errors.nameTaken' });
      else if (err instanceof ApiError) setErrors({ _root: 'server.message' });
      else setErrors({ _root: 'errors.network' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? t('categories.editTitle') : t('categories.addTitle')}
      testId="category-form"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void submit()} loading={busy} disabled={busy}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field
          label={t('categories.name')}
          htmlFor="category-name"
          required
          error={messageForField(errors, 'name', t)}
          labelAccessory={<span className="text-badge text-muted">{`${name.length}/${MAX_NAME}`}</span>}
        >
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              maxLength={MAX_NAME}
              autoComplete="off"
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('categories.namePlaceholder')}
            />
          )}
        </Field>

        <ColorPicker id="category-color" value={color} onChange={setColor} error={messageForField(errors, 'color', t)} />

        <Field label={t('categories.type')} htmlFor="category-type" required>
          {({ id }) => (
            <Select id={id} value={type} onChange={(event) => setType(event.target.value as CategoryType)}>
              <option value="KULIAH">{t('categoryType.KULIAH')}</option>
              <option value="PRIBADI">{t('categoryType.PRIBADI')}</option>
            </Select>
          )}
        </Field>

        {errors._root ? (
          <p role="alert" className="text-label font-medium text-danger">
            {errors._root === 'server.message' ? t('categories.saveFailed') : t(errors._root)}
          </p>
        ) : null}
        {!normalizeHex(color) ? <p className="text-badge text-danger">{t('categories.errors.colorFormat')}</p> : null}
      </div>
    </Modal>
  );
}

/** Form tambah/edit tugas (Issue 045) — field dinamis per tipe, pratinjau prioritas, draf, alur konflik. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { taskInputSchema, priority, type TaskType } from '@swp/shared';
import { useTranslation } from 'react-i18next';
import { History, TriangleAlert } from 'lucide-react';
import { apiFetch, isNetworkError, ApiError } from '../lib/api';
import { invalidateEverything } from '../lib/mutations';
import { checkConflictApi, MAX_CONFLICT_RECHECKS } from '../lib/conflict';
import { clearDraft, loadDraft, saveDraft } from '../lib/draft';
import { localDateTimeToIso, isoToLocalDateTime } from '../lib/format';
import { useConfirm } from '../lib/confirm';
import type { CategoryDto, ConflictResultDto, TaskDto } from '../lib/dto';
import { firstErrorPath, messageForField, serverFieldErrors, zodFieldErrors, type FieldErrors } from '../lib/validation';
import { Button } from './ui/Button';
import { DateTimeField } from './ui/DateTimeField';
import { DayPicker } from './ui/DayPicker';
import { Field } from './ui/Field';
import { Input } from './ui/Input';
import { ScaleSelect } from './ui/ScaleSelect';
import { Select } from './ui/Select';
import { Textarea } from './ui/Textarea';
import { PriorityBadge } from './ui/PriorityBadge';
import { ConflictDialog } from './ConflictDialog';

export interface TaskFormProps {
  mode: 'create' | 'edit';
  initial?: TaskDto;
  categories: CategoryDto[];
  timezone: string;
  userId?: string;
  /** Kategori awal (mis. dari `?scope=kuliah` di halaman form). */
  defaultCategoryId?: string;
  onCancel: () => void;
  onManageCategories: () => void;
  onSaved: (task: TaskDto) => void;
}

interface FormState {
  title: string;
  description: string;
  type: TaskType;
  categoryId: string;
  importance: number;
  difficulty: number;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  deadlineDate: string;
  deadlineTime: string;
  durationHours: string;
  routineDays: number[];
  routineTime: string;
  routineDuration: string;
}

const EMPTY: FormState = {
  title: '',
  description: '',
  type: 'FIXED_TIME',
  categoryId: '',
  importance: 3,
  difficulty: 3,
  startDate: '',
  startTime: '',
  endDate: '',
  endTime: '',
  deadlineDate: '',
  deadlineTime: '',
  durationHours: '2',
  routineDays: [1],
  routineTime: '19:00',
  routineDuration: '1',
};

export function defaultFormState(
  tz: string,
  initial?: TaskDto,
  defaultCategoryId?: string,
): FormState {
  if (!initial) {
    const tomorrow = new Date(Date.now() + 86_400_000);
    const iso = tomorrow.toISOString();
    const { date, time } = isoToLocalDateTime(iso, tz);
    return {
      ...EMPTY,
      categoryId: defaultCategoryId ?? '',
      startDate: date,
      startTime: time,
      deadlineDate: date,
      deadlineTime: time,
    };
  }
  const start = isoToLocalDateTime(initial.startAt, tz);
  const end = isoToLocalDateTime(initial.endAt, tz);
  const deadline = isoToLocalDateTime(initial.deadlineAt, tz);
  return {
    title: initial.title,
    description: initial.description ?? '',
    type: initial.type,
    categoryId: initial.category.id,
    importance: initial.importance,
    difficulty: initial.difficulty,
    startDate: start.date,
    startTime: start.time,
    endDate: end.date,
    endTime: end.time,
    deadlineDate: deadline.date,
    deadlineTime: deadline.time,
    durationHours: String(initial.durationHours || 1),
    routineDays: initial.routineDays ?? [],
    routineTime: initial.routineStartTime ?? '19:00',
    routineDuration: String(initial.durationHours || 1),
  };
}

function buildPayload(state: FormState, tz: string): Record<string, unknown> {
  const base = {
    type: state.type,
    title: state.title.trim(),
    description: state.description,
    categoryId: state.categoryId,
    importance: state.importance,
    difficulty: state.difficulty,
  };
  if (state.type === 'FIXED_TIME') {
    return {
      ...base,
      startAt: localDateTimeToIso(state.startDate, state.startTime, tz) ?? '',
      endAt: localDateTimeToIso(state.endDate, state.endTime, tz) ?? '',
    };
  }
  if (state.type === 'DEADLINE') {
    return {
      ...base,
      deadlineAt: localDateTimeToIso(state.deadlineDate, state.deadlineTime, tz) ?? '',
      durationHours: Number(state.durationHours),
    };
  }
  return {
    ...base,
    routineDays: state.routineDays,
    routineStartTime: state.routineTime,
    durationHours: Number(state.routineDuration),
  };
}

const EMPTY_CONFLICT: ConflictResultDto = {
  collisions: [],
  buffers: [],
  overload: [],
  suggestedSlot: null,
  lowPriorityCandidate: null,
  any: false,
};

export function TaskForm({
  mode,
  initial,
  categories,
  timezone,
  userId,
  defaultCategoryId,
  onCancel,
  onManageCategories,
  onSaved,
}: TaskFormProps) {
  const { t, i18n } = useTranslation();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [state, setState] = useState<FormState>(() => defaultFormState(timezone, initial, defaultCategoryId ?? categories[0]?.id));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<ConflictResultDto | null>(null);
  const [conflictError, setConflictError] = useState<string | undefined>();
  const [recheckCount, setRecheckCount] = useState(0);
  const [draftPrompt, setDraftPrompt] = useState(false);
  const dirtyRef = useRef(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  const payload = useMemo(() => buildPayload(state, timezone), [state, timezone]);
  const parsed = useMemo(() => taskInputSchema.safeParse(payload), [payload]);
  const parsedData = parsed.success ? (parsed.data as unknown as Record<string, unknown>) : undefined;

  const preview = useMemo(() => {
    const data = parsedData;
    if (!data) return null;
    const isoOf = (key: string) => (typeof data[key] === 'string' && data[key] ? new Date(data[key] as string) : null);
    return priority(
      {
        id: initial?.id ?? 'preview',
        type: state.type,
        status: 'TODO',
        importance: state.importance,
        difficulty: state.difficulty,
        startAt: isoOf('startAt'),
        endAt: isoOf('endAt'),
        deadlineAt: isoOf('deadlineAt'),
        durationMinutes: Math.round(Number(data.durationHours ?? 0) * 60),
        routineDays: Array.isArray(data.routineDays) ? (data.routineDays as number[]) : [],
        routineStartMinute:
          typeof data.routineStartTime === 'string'
            ? Number(data.routineStartTime.slice(0, 2)) * 60 + Number(data.routineStartTime.slice(3, 5))
            : null,
      },
      Date.now(),
      timezone,
    );
  }, [parsedData, state, initial?.id, timezone]);

  const pastEvent = useMemo(() => {
    const data = parsedData;
    if (!data) return false;
    const iso = (data.startAt ?? data.deadlineAt) as string | undefined;
    return Boolean(iso) && new Date(String(iso)).getTime() < Date.now();
  }, [parsedData]);

  // Draf otomatis (NFR-03.2) — hanya mode tambah, debounce 500 ms, TTL 7 hari.
  useEffect(() => {
    if (mode !== 'create') return;
    const found = loadDraft<FormState>(userId);
    if (found && found.title) setDraftPrompt(true);
  }, [mode, userId]);

  useEffect(() => {
    if (mode !== 'create' || !dirtyRef.current) return;
    const id = window.setTimeout(() => saveDraft(userId, state), 500);
    return () => window.clearTimeout(id);
  }, [state, mode, userId]);

  // Penjaga perubahan belum tersimpan saat menutup tab.
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const update = useCallback((patch: Partial<FormState>) => {
    dirtyRef.current = true;
    setState((current) => ({ ...current, ...patch }));
  }, []);

  const focusFirstError = (fields: FieldErrors) => {
    const path = firstErrorPath(fields);
    if (!path) return;
    const el = formRef.current?.querySelector<HTMLElement>(`[data-field="${path}"]`);
    el?.focus();
  };

  const applyServerErrors = (err: ApiError) => {
    const fields = serverFieldErrors(err.fields);
    setErrors(fields);
    focusFirstError(fields);
  };

  const saveNow = useCallback(
    async (body: Record<string, unknown>) => {
      setSaving(true);
      try {
        const saved =
          mode === 'edit' && initial
            ? await apiFetch<TaskDto>(`/tasks/${initial.id}`, { method: 'PATCH', body })
            : await apiFetch<TaskDto>('/tasks', { method: 'POST', body });
        invalidateEverything(queryClient);
        if (mode === 'create') clearDraft(userId);
        dirtyRef.current = false;
        setConflict(null);
        onSaved(saved);
      } catch (err) {
        if (err instanceof ApiError && err.status === 400) applyServerErrors(err);
        else if (isNetworkError(err)) setConflictError(t('errors.network'));
        else setConflictError(err instanceof Error ? err.message : t('errors.generic'));
      } finally {
        setSaving(false);
      }
    },
    [mode, initial, userId, onSaved, t],
  );

  const runConflictCheck = useCallback(
    async (body: Record<string, unknown>) => {
      setSaving(true);
      setConflictError(undefined);
      try {
        const result = await checkConflictApi(body, initial?.id);
        if (result.any) {
          setConflict(result);
          return true;
        }
        setConflict(null);
        return false;
      } catch (err) {
        setConflict(EMPTY_CONFLICT);
        setConflictError(isNetworkError(err) ? t('errors.network') : t('errors.conflictCheck'));
        return true;
      } finally {
        setSaving(false);
      }
    },
    [initial?.id, t],
  );

  const submit = async () => {
    if (!parsed.success) {
      const fields = zodFieldErrors(parsed.error.issues);
      setErrors(fields);
      focusFirstError(fields);
      return;
    }
    setErrors({});
    const body = parsed.data as unknown as Record<string, unknown>;
    const hasConflict = await runConflictCheck(body);
    if (hasConflict) return;
    await saveNow(body);
  };

  const useSuggestion = async () => {
    if (!conflict?.suggestedSlot) return;
    const next = recheckCount + 1;
    const start = isoToLocalDateTime(conflict.suggestedSlot.start, timezone);
    const end = isoToLocalDateTime(conflict.suggestedSlot.end, timezone);
    setRecheckCount(next);
    const nextState: FormState = { ...state, startDate: start.date, startTime: start.time, endDate: end.date, endTime: end.time };
    update(nextState);
    if (next > MAX_CONFLICT_RECHECKS) {
      setConflict({ ...conflict, suggestedSlot: null });
      return;
    }
    const body = buildPayload(nextState, timezone);
    if (!taskInputSchema.safeParse(body).success) return;
    await runConflictCheck(body);
  };

  const deleteLowPriority = async () => {
    const candidate = conflict?.lowPriorityCandidate;
    if (!candidate) return;
    const ok = await confirm({
      title: t('tasks.delete.confirmTitle'),
      text: t('tasks.delete.confirm'),
      okLabel: t('common.confirm'),
      danger: true,
    });
    if (!ok) return;
    setSaving(true);
    try {
      await apiFetch<void>(`/tasks/${candidate.id}`, { method: 'DELETE' });
      await saveNow(parsedData ?? payload);
    } catch (err) {
      setConflictError(err instanceof ApiError ? err.message : t('errors.generic'));
      setSaving(false);
    }
  };

  const guardedCancel = async () => {
    if (!dirtyRef.current) {
      onCancel();
      return;
    }
    const ok = await confirm({ title: t('form.unsavedTitle'), text: t('form.unsaved'), okLabel: t('common.leave'), danger: true });
    if (ok) {
      if (mode === 'create') clearDraft(userId);
      onCancel();
    }
  };

  const typeFields = () => {
    if (state.type === 'FIXED_TIME') {
      return (
        <>
          <DateTimeField
            idBase="startAt"
            label={t('tasks.form.startAt')}
            date={state.startDate}
            time={state.startTime}
            error={messageForField(errors, 'startAt', t)}
            onChange={({ date, time }) => update({ startDate: date, startTime: time })}
          />
          <DateTimeField
            idBase="endAt"
            label={t('tasks.form.endAt')}
            date={state.endDate}
            time={state.endTime}
            error={messageForField(errors, 'endAt', t)}
            onChange={({ date, time }) => update({ endDate: date, endTime: time })}
          />
        </>
      );
    }
    if (state.type === 'DEADLINE') {
      return (
        <>
          <DateTimeField
            idBase="deadlineAt"
            label={t('tasks.form.deadline')}
            date={state.deadlineDate}
            time={state.deadlineTime}
            error={messageForField(errors, 'deadlineAt', t)}
            onChange={({ date, time }) => update({ deadlineDate: date, deadlineTime: time })}
          />
          <Field label={t('tasks.form.duration')} htmlFor="durationHours" error={messageForField(errors, 'durationHours', t)} required>
            {({ id, invalid, describedBy }) => (
              <div className="flex items-center gap-2">
                <input
                  id={id}
                  data-field="durationHours"
                  type="number"
                  inputMode="decimal"
                  step={0.5}
                  min={0.5}
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                  value={state.durationHours}
                  onChange={(event) => update({ durationHours: event.target.value })}
                  className="min-h-touch w-32 rounded-card border border-line bg-white px-3 text-base focus:border-primary"
                />
                <span className="text-label text-muted">{t('tasks.form.hoursUnit')}</span>
              </div>
            )}
          </Field>
        </>
      );
    }
    return (
      <>
        <DayPicker
          legend={t('tasks.form.routineDays')}
          value={state.routineDays}
          onChange={(days) => update({ routineDays: days })}
          error={messageForField(errors, 'routineDays', t)}
        />
        <Field label={t('tasks.form.routineStart')} htmlFor="routineTime" error={messageForField(errors, 'routineStartTime', t)} required>
          {({ id, invalid, describedBy }) => (
            <input
              id={id}
              data-field="routineStartTime"
              type="time"
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              value={state.routineTime}
              onChange={(event) => update({ routineTime: event.target.value })}
              className="min-h-touch w-40 rounded-card border border-line bg-white px-3 text-base focus:border-primary"
            />
          )}
        </Field>
        <Field label={t('tasks.form.sessionDuration')} htmlFor="routineDuration" error={messageForField(errors, 'durationHours', t)} hint={t('tasks.form.sessionDurationHint')}>
          {({ id, invalid, describedBy }) => (
            <div className="flex items-center gap-2">
              <input
                id={id}
                data-field="durationHours"
                type="number"
                inputMode="decimal"
                step={0.25}
                min={0.25}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                value={state.routineDuration}
                onChange={(event) => update({ routineDuration: event.target.value })}
                className="min-h-touch w-32 rounded-card border border-line bg-white px-3 text-base focus:border-primary"
              />
              <span className="text-label text-muted">{t('tasks.form.hoursUnit')}</span>
            </div>
          )}
        </Field>
      </>
    );
  };

  const groupedCategories = useMemo(() => {
    const kuliah = categories.filter((category) => category.type === 'KULIAH');
    const pribadi = categories.filter((category) => category.type === 'PRIBADI');
    return { kuliah, pribadi };
  }, [categories]);

  const selectedCategory = categories.find((category) => category.id === state.categoryId);

  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-4"
    >
      {draftPrompt ? (
        <div role="status" className="card flex flex-wrap items-center justify-between gap-2 border-primary/40 bg-primary-xl p-3">
          <span className="flex items-center gap-2 text-label font-semibold text-primary-dark">
            <History aria-hidden="true" size={16} />
            {t('form.draftFound')}
          </span>
          <span className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const found = loadDraft<FormState>(userId);
                if (found) setState({ ...EMPTY, ...found });
                setDraftPrompt(false);
              }}
            >
              {t('form.draftContinue')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                clearDraft(userId);
                setDraftPrompt(false);
              }}
            >
              {t('form.draftDiscard')}
            </Button>
          </span>
        </div>
      ) : null}

      <Field label={t('tasks.form.title')} htmlFor="title" error={messageForField(errors, 'title', t)} required>
        {({ id, invalid, describedBy }) => (
          <Input
            id={id}
            data-field="title"
            maxLength={100}
            autoComplete="off"
            placeholder={t('tasks.form.titlePlaceholder')}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            value={state.title}
            onChange={(event) => update({ title: event.target.value })}
          />
        )}
      </Field>

      <Field
        label={t('tasks.form.description')}
        htmlFor="description"
        error={messageForField(errors, 'description', t)}
        hint={`${state.description.length}/1000`}
      >
        {({ id, invalid, describedBy }) => (
          <Textarea
            id={id}
            data-field="description"
            maxLength={1000}
            placeholder={t('tasks.form.descriptionPlaceholder')}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            value={state.description}
            onChange={(event) => update({ description: event.target.value })}
          />
        )}
      </Field>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="sm:flex-1">
          <Field label={t('tasks.form.type')} htmlFor="type" required error={messageForField(errors, 'type', t)}>
            {({ id, describedBy }) => (
              <Select
                id={id}
                data-field="type"
                aria-describedby={describedBy}
                value={state.type}
                onChange={(event) => update({ type: event.target.value as TaskType })}
              >
                {(['FIXED_TIME', 'DEADLINE', 'ROUTINE'] as const).map((type) => (
                  <option key={type} value={type}>
                    {t(`tasks.type.${type}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <div className="sm:flex-1">
          <Field
            label={t('tasks.form.category')}
            htmlFor="categoryId"
            required
            error={messageForField(errors, 'categoryId', t)}
            labelAccessory={
              <button type="button" onClick={onManageCategories} className="text-badge font-semibold text-primary-dark underline">
                {t('tasks.form.manageCategories')}
              </button>
            }
          >
            {({ id, invalid, describedBy }) => (
              <Select
                id={id}
                data-field="categoryId"
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                value={state.categoryId}
                onChange={(event) => update({ categoryId: event.target.value })}
              >
                <option value="">{t('tasks.form.categoryPlaceholder')}</option>
                <optgroup label={t('categoryType.KULIAH')}>
                  {groupedCategories.kuliah.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label={t('categoryType.PRIBADI')}>
                  {groupedCategories.pribadi.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </optgroup>
              </Select>
            )}
          </Field>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-card border border-dashed border-line p-3">{typeFields()}</div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="sm:flex-1">
          <ScaleSelect
            id="difficulty"
            kind="difficulty"
            label={t('tasks.form.difficulty')}
            value={state.difficulty}
            onChange={(value) => update({ difficulty: value })}
            error={messageForField(errors, 'difficulty', t)}
          />
        </div>
        <div className="sm:flex-1">
          <ScaleSelect
            id="importance"
            kind="importance"
            label={t('tasks.form.importance')}
            value={state.importance}
            onChange={(value) => update({ importance: value })}
            error={messageForField(errors, 'importance', t)}
          />
        </div>
      </div>

      <div className="card flex flex-wrap items-center justify-between gap-2 bg-primary-xl p-3" data-testid="priority-preview">
        <p className="text-label font-semibold text-ink">
          {t('tasks.form.priorityPreview')}{' '}
          {preview ? (
            <>
              {t(`priority.${preview.label}`)} (score {preview.score.toFixed(1)})
            </>
          ) : (
            <span className="text-muted">{t('tasks.form.priorityIncomplete')}</span>
          )}
        </p>
        {preview ? <PriorityBadge label={preview.label} score={preview.score} /> : null}
      </div>

      {pastEvent ? (
        <p role="status" className="flex items-start gap-2 rounded-card bg-[#FFF7ED] p-3 text-label font-medium text-[#9A3412]">
          <TriangleAlert aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
          {t('tasks.form.pastWarning')}
        </p>
      ) : null}

      {selectedCategory ? (
        <p className="text-badge text-muted">
          {t('tasks.form.willAppearIn', { page: t(`categoryType.${selectedCategory.type}`) })}
        </p>
      ) : null}

      <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] z-20 -mx-4 flex gap-2 border-t border-line bg-white px-4 py-3 lg:bottom-0">
        <Button type="button" variant="secondary" className="flex-1" onClick={() => void guardedCancel()} disabled={saving}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" className="flex-1" loading={saving} disabled={saving}>
          {mode === 'edit' ? t('common.saveChanges') : t('tasks.form.add')}
        </Button>
      </div>

      {conflict ? (
        <ConflictDialog
          result={conflict}
          timezone={timezone}
          locale={i18n.language}
          busy={saving}
          error={conflictError}
          recheckCount={recheckCount}
          maxRechecksReached={recheckCount > MAX_CONFLICT_RECHECKS}
          onRetry={() => void runConflictCheck(parsedData ?? payload)}
          onUseSuggestion={() => void useSuggestion()}
          onAdjust={() => {
            setConflict(null);
            setConflictError(undefined);
            setRecheckCount(0);
          }}
          onDeleteLowPriority={() => void deleteLowPriority()}
          onSaveAnyway={() => void saveNow(parsedData ?? payload)}
        />
      ) : null}
    </form>
  );
}

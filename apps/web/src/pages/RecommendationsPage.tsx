/** UISW06 AI Recommendation (Issue 047): mood -> rekomendasi rule-based + self-care + riwayat mood. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { BrainCircuit, HeartHandshake, RefreshCw, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { describeDuration, fmtDateTime } from '../lib/format';
import { useDebouncedValue } from '../lib/hooks';
import { useAuth } from '../lib/auth';
import { useMoodHistory, useRecommendations, useTodayMood } from '../lib/queries';
import { useSetMood } from '../lib/mutations';
import { ErrorBlock, LoadingBlock, PageHeader } from '../components/AppLayout';
import { MoodEmoji, MoodPicker } from '../components/MoodPicker';
import { TaskDetailDialog } from '../components/TaskDetailDialog';
import { useToast } from '../components/Toast';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { PriorityBadge } from '../components/ui/PriorityBadge';

export function RecommendationsPage() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const { user } = useAuth();

  const todayMood = useTodayMood();
  const history = useMoodHistory(7);
  const setMood = useSetMood();

  const [selected, setSelected] = useState<number | null>(null);
  /** Mood yang sudah benar-benar tersimpan di server dan dipakai untuk query rekomendasi. */
  const [committed, setCommitted] = useState<number | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [tipIndex, setTipIndex] = useState(0);

  const debouncedSelected = useDebouncedValue(selected, 400);
  /** Objek hasil `useSetMood()` berganti tiap render; lewat ref agar efek debounce tidak berputar. */
  const setMoodRef = useRef(setMood);
  setMoodRef.current = setMood;

  useEffect(() => {
    // FR-06.3: setelah rekomendasi pertama tampil, mengganti mood langsung memperbarui hasil.
    if (committed == null || debouncedSelected == null || debouncedSelected === committed) return;
    setMoodRef.current.mutate(debouncedSelected, {
      onSuccess: () => setCommitted(debouncedSelected),
      onError: () => toast.error(t('errors.generic')),
    });
  }, [debouncedSelected, committed, toast, t]);

  const recommendations = useRecommendations(committed ?? undefined, committed != null);
  const data = recommendations.data;

  const energyLabel = committed ? t(`mood.label.${committed}`) : null;
  const tipKeys = data?.selfCare.tipKeys ?? [];
  const activeTip = useMemo(() => tipKeys[tipIndex % Math.max(1, tipKeys.length)] ?? null, [tipKeys, tipIndex]);

  if (!user) return null;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('nav.ai')} subtitle={t('rec.subtitle')} />

      {todayMood.data?.level ? (
        <p className="text-label text-muted">
          {t('rec.lastMood', { label: t(`mood.label.${todayMood.data.level}`) })} <MoodEmoji level={todayMood.data.level} />
          {todayMood.data.at ? ` · ${fmtDateTime(todayMood.data.at, user.timezone, i18n.language)}` : ''}
        </p>
      ) : null}

      <Card as="section" ariaLabel={t('rec.moodQuestion')} className="flex flex-col gap-3 p-4">
        <h2 className="text-h2 font-bold">{t('rec.moodQuestion')}</h2>
        <MoodPicker
          value={selected ?? todayMood.data?.level ?? null}
          disabled={setMood.isPending}
          onChange={(level) => {
            setSelected(level);
            if (committed == null) {
              setMood.mutate(level, {
                onSuccess: () => setCommitted(level),
                onError: () => toast.error(t('errors.generic')),
              });
            }
          }}
        />
        {committed ? (
          <p className="text-label text-muted">
            {t(data?.energyKey ?? 'rec.energy.medium')} · {energyLabel}
          </p>
        ) : (
          <p className="text-badge text-muted">{t('rec.pickMood')}</p>
        )}
        <Button
          icon={<Sparkles aria-hidden="true" size={18} />}
          block
          loading={setMood.isPending || (recommendations.isFetching && committed != null)}
          disabled={selected == null || setMood.isPending}
          onClick={() => {
            if (selected == null) return;
            setMood.mutate(selected, {
              onSuccess: () => setCommitted(selected),
              onError: () => toast.error(t('errors.generic')),
            });
          }}
        >
          {t('rec.getRecommendations')}
        </Button>
      </Card>

      {data && (data.selfCare.level === 1 || data.selfCare.level === 2) ? (
        <Card
          as="section"
          ariaLabel={t('rec.selfCare.title')}
          className={`flex flex-col gap-3 p-4 ${data.selfCare.level === 1 ? 'border-ok/40 bg-[#F0FDF4]' : 'border-primary/30 bg-primary-xl'}`}
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-h2 font-bold">
              <HeartHandshake aria-hidden="true" size={20} />
              {t('rec.selfCare.title')}
            </h2>
            {tipKeys.length > 1 ? (
              <Button
                size="sm"
                variant="ghost"
                icon={<RefreshCw aria-hidden="true" size={16} />}
                onClick={() => setTipIndex((index) => index + 1)}
              >
                {t('rec.selfCare.refresh')}
              </Button>
            ) : null}
          </div>
          {data.selfCare.level === 1 ? (
            <ul className="flex flex-col gap-2 text-body">
              {tipKeys.map((key) => (
                <li key={key}>· {t(key)}</li>
              ))}
              <li>· {t('rec.selfCare.contactSupport')}</li>
            </ul>
          ) : (
            <p className="text-body">{activeTip ? t(activeTip) : null}</p>
          )}
        </Card>
      ) : null}

      {committed != null && recommendations.isLoading ? <LoadingBlock /> : null}
      {recommendations.isError ? <ErrorBlock onRetry={() => void recommendations.refetch()} /> : null}

      {data ? (
        <section aria-label={t('rec.listTitle')} className="flex flex-col gap-3">
          <h2 className="text-h2 font-bold">{t('rec.listTitle')}</h2>
          {data.items.length === 0 ? (
            <p className="card p-4 text-label text-muted">{t('rec.empty')}</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {data.items.map((item, index) => (
                <li key={item.task.id}>
                  <button
                    type="button"
                    onClick={() => setDetailId(item.task.id)}
                    className="card flex w-full flex-col gap-2 p-3 text-left hover:bg-primary-xl"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-pill bg-primary-light text-badge font-bold text-primary-dark">
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1 break-words text-base font-semibold">{item.task.title}</span>
                      {item.isTopPick ? (
                        <span className="badge bg-primary-dark text-white">
                          <BrainCircuit aria-hidden="true" size={12} />
                          {t('rec.topPick')}
                        </span>
                      ) : null}
                      <PriorityBadge label={item.task.priority.label} score={item.task.priority.score} size="sm" />
                      <span className="text-badge font-semibold text-primary-dark">{t('rec.match', { percent: item.matchPercent })}</span>
                    </span>
                    <p className="text-label text-muted">{t(item.reasonKey, item.reasonParams)}</p>
                    <span className="flex flex-wrap gap-2 text-badge text-muted">
                      {item.task.category ? (
                        <span className="badge bg-bg" style={{ color: item.task.category.color }}>
                          {item.task.category.name}
                        </span>
                      ) : null}
                      <span className="badge bg-bg">{t(`scale.difficulty.${item.task.difficulty}`)}</span>
                      <span className="badge bg-bg">{t(`scale.importance.${item.task.importance}`)}</span>
                      {item.task.eventAt ? (
                        <span className="badge bg-bg">{fmtDateTime(item.task.eventAt, user.timezone, i18n.language)}</span>
                      ) : null}
                      <span className="badge bg-bg">{describeDuration(item.task.durationHours, t)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>
      ) : null}

      {data && data.postpone.length > 0 ? (
        <section aria-label={t('rec.postponeTitle')} className="flex flex-col gap-2">
          <h2 className="text-h2 font-bold">{t('rec.postponeTitle')}</h2>
          <ul className="flex flex-col gap-2">
            {data.postpone.map((item) => (
              <li key={item.task.id} className="card flex flex-wrap items-center gap-2 p-3">
                <span className="min-w-0 flex-1 break-words text-base font-semibold">{item.task.title}</span>
                <span className="text-badge text-muted">{t(item.reasonKey, item.reasonParams)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {history.data && history.data.length > 0 ? (
        <Card as="section" ariaLabel={t('rec.history.title')} className="flex flex-col gap-2 p-4">
          <h2 className="text-base font-bold">{t('rec.history.title')}</h2>
          <ul className="flex flex-wrap gap-3">
            {history.data.map((entry) => (
              <li key={entry.id ?? entry.at} className="flex flex-col items-center gap-1">
                <span className="text-2xl" aria-hidden="true">
                  <MoodEmoji level={entry.level} />
                </span>
                <span className="sr-only">{t(`mood.label.${entry.level}`)}</span>
                <span className="text-badge text-muted">{fmtDateTime(entry.at, user.timezone, i18n.language)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <p className="text-badge text-muted">{t('rec.disclaimer')}</p>

      {detailId ? <TaskDetailDialog taskId={detailId} onClose={() => setDetailId(null)} /> : null}
    </div>
  );
}

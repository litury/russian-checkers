import { ensureGuest, loadStats } from '@/online/cloud';
import { runtimeApiOrigin } from '@/online/apiOrigin';

// No binding-status endpoint exists. Confirmation is only known in this page's memory.
export function bindProfileOverview() {
 const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
 const identity = el('profile-identity');
 const stats = el('profile-stats');
 const retry = el<HTMLButtonElement>('profile-stats-retry');
 const status = el('profile-account-status');
 const email = el<HTMLInputElement>('profile-email');
 const code = el<HTMLInputElement>('profile-email-code');
 const forms = [el<HTMLFormElement>('profile-email-form'), el<HTMLFormElement>('profile-code-form')];
 let busy = false, loading = false;
 let guest: Awaited<ReturnType<typeof ensureGuest>> = null;
 async function refresh() {
  if (loading) return;
  loading = true;
  retry.hidden = true;
  stats.textContent = 'Загрузка…';
  try {
   guest = await ensureGuest();
   identity.textContent = guest ? `Игрок · ${guest.id}` : 'Не удалось получить игрока.';
   const data = guest ? await loadStats() : null;
   if (!data || ![data.games, data.white_wins, data.black_wins].every(n => Number.isSafeInteger(n) && n >= 0)) throw new Error('stats');
   stats.textContent = `Партий: ${data.games}. Побед белыми: ${data.white_wins}, чёрными: ${data.black_wins}.`;
  } catch {
   stats.textContent = 'Статистика недоступна. Попробуйте ещё раз.';
   retry.hidden = false;
  } finally { loading = false; }
 }
 retry.addEventListener('click', () => { void refresh(); });
 forms.forEach((form, index) => form.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy || !forms[0].reportValidity() || !form.reportValidity()) return;
  busy = true;
  const controls = forms.flatMap(f => [...f.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input,button')]);
  controls.forEach(c => { c.disabled = true; });
  status.textContent = 'Загрузка…';
  try {
   guest ??= await ensureGuest();
   if (!guest) throw new Error('identity');
   const response = await fetch(`${runtimeApiOrigin()}/auth/email/${index ? 'confirm' : 'start'}`, {
    method: 'POST', signal: AbortSignal.timeout(10000),
    headers: { 'content-type': 'application/json', authorization: `Bearer ${guest.token}` },
    body: JSON.stringify({ email: email.value, ...(index ? { code: code.value } : {}) }),
   });
   const result = await response.json();
   if (response.ok && result.ok) {
    status.textContent = index ? 'Почта привязана к текущему игроку.' : result.dev
     ? 'Код доступен только в логе сервера. Отправка письма не настроена.' : 'Код запрошен. Введите полученный код.';
    if (index) {
     code.value = '';
     el('profile-binding-summary').textContent = 'Привязка почты подтверждена в этой сессии.';
    }
   } else {
    const errors: Record<string, string> = { link_conflict: 'Эта почта уже у другого игрока.', bad_code: 'Код не подошёл или истёк. Запросите новый.', bad_email: 'Проверьте адрес почты.', rate: 'Слишком много запросов. Попробуйте позже.', unauthorized: 'Игрок недоступен. Откройте профиль повторно.' };
    status.textContent = errors[result.error] ?? 'Не удалось выполнить запрос. Попробуйте ещё раз.';
   }
  } catch { status.textContent = 'Нет соединения с сервером. Попробуйте ещё раз.'; }
  finally { busy = false; controls.forEach(c => { c.disabled = false; }); }
 }));
 return { refresh };
}

import './onlineHub.css';

/** The approved hub is a modal like «Партии». Matchmaking itself stays in the existing search UI. */
export function createOnlineHub(actions: {
 find: () => void;
 create: () => void;
 enter: () => void;
 cancel: () => void;
}) {
 const dialog = document.createElement('dialog');
 dialog.id = 'online-hub';
 dialog.setAttribute('aria-labelledby', 'online-hub-title');
 dialog.innerHTML = `<div class="oh-panel">
  <header class="oh-header"><div class="oh-title-plate"><p class="oh-eyebrow">Игра по сети</p><h2 id="online-hub-title" tabindex="-1">Онлайн</h2></div><button type="button" class="oh-button" data-action="cancel"><span>В меню</span></button></header>
  <div class="oh-scroll"><section class="oh-actions" aria-label="Действия">
   <button type="button" class="oh-button" data-action="find"><span>Найти</span></button>
   <button type="button" class="oh-button" data-action="create"><span>Создать</span></button>
   <button type="button" class="oh-button oh-code" data-action="enter"><span>Ввести код</span></button>
  </section></div>
 </div>`;
 document.body.append(dialog);
 const title = dialog.querySelector<HTMLElement>('h2')!;
 const navigationKey = `online-hub-${Date.now()}`;
 let wanted = false;
 let leaving = false;
 let disposed = false;
 const focusReturn = () => document.getElementById('opening-online')?.focus({preventScroll: true});
 const open = () => {
  if (disposed || dialog.open || leaving || !wanted) return;
  history.pushState({...history.state, onlineHub: navigationKey}, '');
  dialog.showModal();
  title.focus({preventScroll: true});
 };
 const close = () => {
  if (!dialog.open) return;
  dialog.close();
  if (history.state?.onlineHub === navigationKey) {
   leaving = true;
   history.back();
  }
 };
 const cancel = () => {
  wanted = false;
  close();
  actions.cancel();
  focusReturn();
 };
 const pop = () => {
  if (leaving) {
   leaving = false;
   open();
  } else if (dialog.open && history.state?.onlineHub !== navigationKey) {
   wanted = false;
   dialog.close();
   actions.cancel();
   focusReturn();
  }
 };
 dialog.addEventListener('cancel', event => { event.preventDefault(); cancel(); });
 dialog.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button => {
  button.addEventListener('click', () => {
   const action = button.dataset.action as keyof typeof actions;
   if (action === 'cancel') cancel();
   else actions[action]();
  });
 });
 window.addEventListener('popstate', pop);
 return {
  setVisible(visible: boolean) {
   wanted = visible;
   if (visible) open();
   else close();
  },
  setCount(count: number | null) {
   title.textContent = count === null ? 'Онлайн' : `Онлайн: ${count}`;
  },
  dispose() {
   disposed = true;
   wanted = false;
   close();
   window.removeEventListener('popstate', pop);
   dialog.remove();
  },
 };
}

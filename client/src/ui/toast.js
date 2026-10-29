import gsap from 'gsap';

/** Notificación breve con acción opcional. */
export function createToast(element = document.getElementById('toast')) {
  let timer;
  return function toast(message, action) {
    clearTimeout(timer);
    element.innerHTML = '';
    const text = document.createElement('span');
    text.textContent = message;
    element.append(text);
    if (action) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = action.label;
      button.addEventListener('click', () => {
        action.onClick();
        hide();
      });
      element.append(button);
    }
    gsap.fromTo(element, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power3.out' });
    timer = setTimeout(hide, 3800);
  };

  function hide() {
    gsap.to(element, { autoAlpha: 0, y: 20, duration: 0.3 });
  }
}

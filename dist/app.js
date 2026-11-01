const menu = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
menu.addEventListener('click', () => {
  const expanded = menu.getAttribute('aria-expanded') === 'true';
  menu.setAttribute('aria-expanded', String(!expanded));
  navigation.classList.toggle('open', !expanded);
});
navigation.addEventListener('click', (event) => {
  if (event.target.closest('a')) {
    menu.setAttribute('aria-expanded', 'false');
    navigation.classList.remove('open');
  }
});
document.querySelectorAll('[data-stage]').forEach(link => {
  link.addEventListener('click', () => { document.querySelector('#stage').value = link.dataset.stage; });
});
document.querySelector('#year').textContent = new Date().getFullYear();
const stageTabs = [...document.querySelectorAll('[role="tab"]')];
function selectStage(tab) {
  stageTabs.forEach(item => {
    const selected = item === tab;
    item.setAttribute('aria-selected', String(selected));
    item.tabIndex = selected ? 0 : -1;
    document.getElementById(item.dataset.panel).hidden = !selected;
  });
}
stageTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectStage(tab));
  tab.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % stageTabs.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + stageTabs.length) % stageTabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = stageTabs.length - 1;
    if (next !== undefined) {
      event.preventDefault();
      selectStage(stageTabs[next]);
      stageTabs[next].focus();
    }
  });
});
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('reveal');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });
  document.querySelectorAll('.section').forEach(section => observer.observe(section));
  const navigationObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const link = navigation.querySelector(`a[href="#${entry.target.id}"]`);
      if (!link) return;
      if (entry.isIntersecting) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }, { rootMargin: '-15% 0px -55% 0px' });
  document.querySelectorAll('section[id]').forEach(section => navigationObserver.observe(section));
}
document.querySelector('#enquiry-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const contents = `BM International School — Admissions enquiry\n\nName: ${data.get('name')}\nEmail: ${data.get('email')}\nStage: ${data.get('stage')}\n\n${data.get('message') || 'No additional message.'}\n\nPrepared locally. This enquiry has not been sent to the school.\n`;
  const url = URL.createObjectURL(new Blob([contents], { type: 'text/plain;charset=utf-8' }));
  const download = document.createElement('a');
  download.href = url;
  download.download = 'BM-school-enquiry.txt';
  document.body.append(download);
  download.click();
  download.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  document.querySelector('#form-status').textContent = 'Your enquiry file is ready. Save it for later; it has not been sent to the school.';
});

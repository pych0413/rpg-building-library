'use strict';
const statusLine = document.querySelector('#status');
const controlIds = ['query', 'size-filter', 'category-filter', 'blocks-min', 'blocks-max', 'width-max', 'height-max', 'depth-max'];
const controls = Object.fromEntries(controlIds.map(id => [id, document.getElementById(id)]));
const tagInputs = [...document.querySelectorAll('#tag-options input')];
const sections = [...document.querySelectorAll('section')].map(section => ({
  element: section,
  cards: [...section.querySelectorAll('.card')].map(element => ({
    element,
    text: element.textContent.toLowerCase(),
    tags: JSON.parse(element.dataset.tags || '[]'),
    blocks: element.dataset.blocks === '' ? null : Number(element.dataset.blocks),
    dims: JSON.parse(element.dataset.dims || 'null'),
    size: element.dataset.size,
  })),
}));

function readLimit(id) {
  const input = controls[id];
  if (input.validity && input.validity.badInput) return NaN;
  const value = input.value.trim();
  return value === '' ? null : Number(value);
}

function matchesBuilding(card, options, category) {
  if (options.category && category !== options.category) return false;
  if (options.size && card.size !== options.size) return false;
  if (!options.words.every(word => card.text.includes(word))) return false;
  if (!options.tags.every(tag => card.tags.includes(tag))) return false;
  if (options.min !== null || options.max !== null) {
    if (card.blocks === null) return false;
    if (options.min !== null && card.blocks < options.min) return false;
    if (options.max !== null && card.blocks > options.max) return false;
  }
  return options.dims.every((limit, axis) => limit === null || (card.dims !== null && card.dims[axis] <= limit));
}

function filterCards() {
  const min = readLimit('blocks-min'), max = readLimit('blocks-max');
  const dims = ['width-max', 'height-max', 'depth-max'].map(readLimit);
  const invalid = [min, max, ...dims].some(n => n !== null && (!Number.isSafeInteger(n) || n < 0));
  const message = invalid ? '請輸入 0 或以上嘅整數。' : min !== null && max !== null && min > max ? '最少方塊數唔可以大過最多方塊數。' : '';
  document.getElementById('filter-error').textContent = message;
  const tags = tagInputs.filter(input => input.checked).map(input => input.value);
  const options = {min, max, dims, tags, words: controls.query.value.toLowerCase().trim().split(/\s+/), size: controls['size-filter'].value, category: controls['category-filter'].value};
  let visible = 0;
  for (const section of sections) {
    let count = 0;
    for (const card of section.cards) {
      const show = !message && matchesBuilding(card, options, section.element.id);
      card.element.hidden = !show;
      if (show) count++;
    }
    section.element.hidden = count === 0;
    visible += count;
  }
  statusLine.textContent = message ? '請先修正篩選範圍。' : `顯示 ${visible.toLocaleString()} / 4,071 項建築`;
  document.getElementById('empty-results').hidden = visible !== 0 || Boolean(message);
  document.getElementById('tag-summary').textContent = tags.length ? `標籤（已選 ${tags.length} 個，全部符合）` : '標籤（可複選）';
  document.querySelectorAll('.tag-button').forEach(button => button.setAttribute('aria-pressed', String(tags.includes(button.dataset.tag))));
}

let filterTimer;
for (const control of Object.values(controls)) {
  control.addEventListener(control.tagName === 'SELECT' ? 'change' : 'input', () => {
    clearTimeout(filterTimer);
    filterTimer = setTimeout(filterCards, 100);
  });
}
tagInputs.forEach(input => input.addEventListener('change', filterCards));
document.getElementById('tag-search').addEventListener('input', event => {
  const word = event.target.value.trim().toLowerCase();
  tagInputs.forEach(input => { input.parentElement.hidden = !input.value.toLowerCase().includes(word); });
});
document.getElementById('reset-filters').addEventListener('click', () => {
  clearTimeout(filterTimer);
  Object.values(controls).forEach(input => { input.value = ''; });
  tagInputs.forEach(input => { input.checked = false; input.parentElement.hidden = false; });
  document.getElementById('tag-search').value = '';
  filterCards();
});
document.addEventListener('click', async event => {
  const tagButton = event.target.closest('.tag-button');
  if (tagButton) {
    const input = tagInputs.find(input => input.value === tagButton.dataset.tag);
    if (input) { input.checked = !input.checked; filterCards(); }
    return;
  }
  const button = event.target.closest('button[data-copy]');
  if (!button) return;
  const command = button.dataset.copy;
  try {
    await navigator.clipboard.writeText(command);
    statusLine.textContent = '已複製：' + command;
  } catch {
    const field = document.createElement('textarea');
    field.value = command; document.body.append(field); field.select();
    statusLine.textContent = document.execCommand('copy') ? '已複製：' + command : command;
    field.remove();
  }
});
filterCards();

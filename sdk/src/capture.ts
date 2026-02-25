import { enqueue } from './transport'

export function startCapture() {
  // page view
  enqueue({
    type: 'page_view',
    timestamp: Date.now(),
    meta: { url: location.pathname }
  })

  // clicks
  document.addEventListener('click', e => {
    const target = e.target as HTMLElement
    if (!target) return

    enqueue({
      type: 'click',
      timestamp: Date.now(),
      meta: {
        tag: target.tagName,
        selector: getSelector(target)
      }
    })
  })
}

function getSelector(el: HTMLElement): string {
  if (el.id) return `#${el.id}`
  if (el.className) return `.${el.className}`
  return el.tagName.toLowerCase()
}

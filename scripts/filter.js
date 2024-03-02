export default function filterOptions() {
  const filters = document.querySelectorAll(".filter")
  filters.forEach((filter) => {
    initFilter(filter)
  })
}

function initFilter(filter) {
  const options = filter.querySelectorAll(".option")
  const entries = filter.querySelectorAll(".entry")

  options.forEach((option) => {
    option.addEventListener("click", () => {
      if (option.classList.contains("active")) return
      // else if (option.dataset.all) {
      //   entries.forEach((entry) => entry.classList.remove("blur"))
      //   options.forEach((o) => o.classList.remove("active"))
      //   option.classList.add("active")
      //   return
      // }
      entries.forEach((entry) => {
        if (!entry.dataset.options.includes(option.dataset.option))
          return entry.classList.add("inactive")
        entry.classList.remove("inactive")
      })
      options.forEach((o) => o.classList.remove("active"))
      option.classList.add("active")
    })
  })

  entries.forEach((entry) => {
    entry.addEventListener("click", () => {
      if (!entry.classList.contains("inactive"))
        return openIframeInDialog(entry)
      options.forEach((option) => {
        if (entry.dataset.options.includes(option.dataset.option)) {
          option.click()
        }
      })
    })
  })

  options[0].click()
}

function openIframeInDialog(entry) {
  let innerHTML
  if (entry.dataset.url) {
    innerHTML = `<iframe src="${entry.dataset.url}" frameborder="0"></iframe>`
  } else if (entry.dataset.blockq) {
    innerHTML = entry.dataset.blockq
  } else if (entry.dataset.link) {
    window.location.href = entry.dataset.link
    return
  }
  const dialog = document.querySelector(".site-dialog")
  dialog.innerHTML = innerHTML
  dialog.showModal()
  dialog.addEventListener("click", (e) => {
    if (e.target.classList.contains("site-dialog")) e.target.close()
  })
}

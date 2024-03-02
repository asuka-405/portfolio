export function barChart() {
  const barCharts = document.querySelectorAll(".bar-chart")
  const barChartObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const chartEntries = entry.target.querySelectorAll(".entry")
      chartEntries.forEach((chartEntry) => setBarWidths(chartEntry, entry))
    })
  })
  barCharts.forEach((chart) => {
    barChartObserver.observe(chart)
  })
}
function setBarWidths(chart, entry) {
  const bars = chart.querySelectorAll(".bar")
  bars.forEach((bar) => {
    entry.isIntersecting
      ? (bar.style.width = chart.getAttribute("data").concat("%"))
      : (bar.style.width = "0%")
  })
}

export function animate(className, toggleClass) {
  const elm = document.querySelectorAll(className)
  const elmObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        console.log("intersecting" + entry.target.classList)
        entry.target.classList.add(toggleClass)
      } else {
        entry.target.classList.remove(toggleClass)
      }
    })
  })
  elm.forEach((e) => {
    elmObserver.observe(e)
  })
  animateFloatingLinks()
}

function animateFloatingLinks() {
  const links = document.querySelector(".links")
  setTimeout(() => {
    links.style.opacity = 1
  }, 1000)
}

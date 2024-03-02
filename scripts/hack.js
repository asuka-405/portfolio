export default function hackTextOnPage() {
  const hackableText = document.querySelectorAll(".hack-text")

  const hacker = new IntersectionObserver(hackOnIntersect)

  hackableText.forEach((text) => {
    hacker.observe(text)
  })

  function hackOnIntersect(entries) {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        randomiseText(entry.target)
      }
    })
  }

  function randomiseText(element) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    const hackSpeed = element.getAttribute("hack-speed") || 100
    const target = element.getAttribute("text-after")
    let iterationCount = 0
    const interval = setInterval(() => {
      element.innerText = target
        .split("")
        .map((char, index) => {
          let curChar
          if (index < iterationCount) curChar = target[index]
          else curChar = chars[Math.floor(Math.random() * 36)]
          if (element.getAttribute("preserve-casing") === "true") return curChar
          return curChar.toUpperCase()
        })
        .join("")
      if (iterationCount > target.length) clearInterval(interval)
      iterationCount++
    }, hackSpeed)
  }
}

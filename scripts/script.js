import { generateTagCloud } from "./misc.js"
import { animate, barChart } from "/scripts/animate.js"
import filterOptions from "/scripts/filter.js"
import hackTextOnPage from "/scripts/hack.js"
import loadParticles from "/scripts/particles.load.js"
generateTagCloud()

document.querySelectorAll(".tagcloud--item").forEach((tag) => {
  tag.classList.add("hack-text")
  tag.classList.add("fade-in")
  tag.setAttribute("text-after", tag.textContent)
  tag.setAttribute("preserve-casing", "true")
})

hackTextOnPage()
barChart()
loadParticles()
filterOptions()

animate(".fade-in", "fade-in--active")
animate(".slide-in", "slide-in--active")

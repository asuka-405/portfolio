document
    .querySelector(".article")
    .querySelectorAll(".image.article-item")
    .forEach((image) => {
        image.addEventListener("click", () => {
            image.classList.toggle("expanded-image")
        })
    })

document.querySelectorAll("pre").forEach((code) => {
    Prism.highlightElement(code, false, function () {})
})

const title = document.querySelector(".title")
title.style.marginTop = "2.5rem"

const homeLink = document.createElement("a")
homeLink.href = "/"
homeLink.innerText = "Home"

const articlesLink = document.createElement("a")
articlesLink.href = "/article"
articlesLink.innerText = "Articles"

const nav = document.createElement("nav")
nav.classList.add("article-nav")
nav.appendChild(homeLink)
nav.appendChild(articlesLink)

document.body.appendChild(nav)

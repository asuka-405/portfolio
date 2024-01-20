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

const title = document.querySelectorAll(".title")
title.innerHTML =
    title.innerText +
    `<nav class="article-nav">
<a href="/">Home</a>
<a href="/article/editor/">Editor</a>
</nav>`

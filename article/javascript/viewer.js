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

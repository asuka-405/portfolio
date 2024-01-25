document.querySelectorAll(".article").forEach(appendIllustration)

function appendIllustration(node) {
    if (node.querySelector("img")) {
        return
    }

    const random = Math.floor(Math.random() * 8) + 1
    const illustrationPath = `/article/assets/illustrations/${random}.svg`
    const illustration = document.createElement("img")
    illustration.src = illustrationPath
    illustration.classList.add("article_img")
    const illustrationWrapper = document.createElement("div")
    illustrationWrapper.classList.add("article_img_wrapper")
    illustrationWrapper.classList.add("img_def")
    illustrationWrapper.appendChild(illustration)
    node.insertBefore(illustrationWrapper, node.querySelector("a"))
}

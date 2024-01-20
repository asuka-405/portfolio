export function setImage(imageNode) {
    let imageElement
    const fileInput = document.createElement("input")
    fileInput.type = "file"
    fileInput.accept = "image/*"
    fileInput.addEventListener("change", (event) => {
        const file = event.target.files[0]
        const reader = new FileReader()
        reader.onload = (e) => {
            const src = e.target.result
            if (!src) {
                imageNode.remove()
                return
            }
            imageNode.querySelector("img").src = src
            if (!imageElement) {
                imageElement = new Image()
                imageElement.src = src
            }
        }
        reader.readAsDataURL(file)
    })
    fileInput.click()
    return imageElement
}

export function newItem(tag, text, attributes, parentAttrs) {
    const itemContainer = document.createElement("div")
    setAttributes(itemContainer, parentAttrs)
    const item = document.createElement(tag)
    item.contentEditable = true
    item.classList.add("content")

    setAttributes(item, attributes)

    if (text) item.innerText = text
    itemContainer.appendChild(item)
    itemContainer.appendChild(bindDeleteButton(itemContainer))
    return itemContainer
}

function bindDeleteButton(parent) {
    const deleteButton = document.createElement("div")
    deleteButton.classList.add("absolute")
    deleteButton.classList.add("delete")
    const deleteIcon = document.createElement("img")
    deleteIcon.src = "/article/assets/delete.svg"
    deleteButton.appendChild(deleteIcon)
    deleteButton.addEventListener("click", () => {
        parent.remove()
    })
    return deleteButton
}

function setAttributes(element, attrs) {
    for (let key in attrs) {
        try {
            if (key === "classList") {
                attrs.classList.push("article-item")
                element.classList.add(...attrs[key])
            } else if (typeof attrs[key] === "object") {
                setAttributes(element[key], attrs[key])
            } else if (key == 0) {
                continue
            } else {
                console.log("key: ", key)
                element[key] = attrs[key]
            }
        } catch (e) {
            console.error({ element, key, "error: ": e })
        }
    }
}

export function getCurrentArticleHtml() {
    const article = document.querySelector(".article")
    article.classList.remove("editor")
    article.querySelectorAll("*").forEach((item) => {
        item.removeAttribute("contenteditable")
    })
    article.querySelectorAll(".delete").forEach((item) => {
        item.remove()
    })
    article.querySelector(".title").innerHTML =
        article.querySelector(".title").innerText +
        `<nav class="article-nav">
    <a href="/">Home</a>
    <a href="/article/editor/">Editor</a>
</nav>`
    const title = article.querySelector(".title").innerText
    const content = article.outerHTML

    const html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="/article/styles/main.css" />
    <link rel="stylesheet" href="/vendor/prism/prism.css" />
    <script src="/vendor/prism/prism.js"></script>
    <script src="/article/javascript/viewer.js" defer></script>
    <meta name="darkreader-lock" />
    <title>${title}</title>
  </head>
  <body>
    ${content}
  </body>
  </html>
  
  `

    return html
}

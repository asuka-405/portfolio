import { newItem, setImage } from "/article/javascript/editor/helpers.js"

export function newH2() {
    return newItem("h2", "Heading2!!", undefined, {
        classList: ["heading", "h2"],
    })
}

export function newH3() {
    return newItem("h3", "Heading3!!", undefined, {
        classList: ["heading", "h3"],
    })
}

export function newText() {
    return newItem("p", "Paragraph!!", undefined, { classList: ["text"] })
}

export function newCodeSnippet() {
    const codeSnippet = document.createElement("pre")
    codeSnippet.contentEditable = true
    codeSnippet.classList.add("language-javascript")
    codeSnippet.appendChild(document.createElement("code"))

    const codeSnippetContainer = newItem("div", undefined, undefined, {
        classList: ["code"],
    })
    codeSnippetContainer.appendChild(codeSnippet)
    codeSnippetContainer.addEventListener("click", () => {
        codeSnippetContainer.classList.toggle("expanded-item")
    })
    return codeSnippetContainer
}

export function newImage() {
    const image = newItem(
        "img",
        undefined,
        {
            src: "",
        },
        {
            classList: ["image"],
        }
    )
    image.addEventListener("click", () => {
        image.classList.toggle("expanded-item")
    })
    setImage(image)
    return image
}
